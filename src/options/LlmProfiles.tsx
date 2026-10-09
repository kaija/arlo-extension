import { useMemo, useState } from 'react';

import { CopyIcon, PlusIcon, TrashIcon } from '../design-system/icons';
import { sendToBackground, type LlmDiagnostic } from '../shared/messages';
import {
  LLM_API_CONTRACTS,
  contractDefaultBaseUrl,
  contractSupportsVoice,
  contractLabel,
  createLlmProfile,
  isRemoteHttpOrigin,
  normalizeBaseUrl,
  profileEndpoint,
  profileOrigin,
  profileErrors,
  voiceEnabled,
  type LlmApiContract,
  type LlmProfile,
  type Settings,
} from '../shared/settings';
import { Alert, Field, SelectWrap, Switch } from './controls';
import { useOptionsText, type OptionsText } from './text';

interface LlmProfilesProps {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => Promise<Settings>;
}

function cloneProfile(profile: LlmProfile): LlmProfile {
  return {
    ...profile,
    modelIds: [...profile.modelIds],
    discovery: { ...profile.discovery },
  };
}

function safeOrigin(profile: Pick<LlmProfile, 'baseUrl'>): string | null {
  try {
    return profileOrigin(profile);
  } catch {
    return null;
  }
}

/** Discovery status carries a state colour, so it maps onto the badge tones. */
const DISCOVERY_TONE: Record<LlmProfile['discovery']['status'], string> = {
  available: 'badge-success',
  unavailable: 'badge-warning',
  failed: 'badge-danger',
  untested: 'badge-neutral',
};

/** Offered for the voice model field; any ID the endpoint accepts can still be typed. */
const OPENAI_VOICE_HINTS = [
  'gpt-live-transcribe',
  'gpt-4o-transcribe',
  'gpt-4o-mini-transcribe',
  'whisper-1',
];
const GEMINI_VOICE_HINTS = ['gemini-3.5-transcribe-live'];

function voiceModelSuggestions(profile: LlmProfile): string[] {
  if (profile.apiContract === 'gemini') {
    const discovered = profile.modelIds.filter((id) => /live|native-audio/i.test(id));
    return [...new Set([...GEMINI_VOICE_HINTS, ...discovered])];
  }
  const discovered = profile.modelIds.filter((id) =>
    /transcribe|whisper|stt|speech|audio/i.test(id),
  );
  return [...new Set([...discovered, ...OPENAI_VOICE_HINTS])];
}

function voiceModelHint(profile: LlmProfile, t: OptionsText): string {
  return profile.apiContract === 'gemini' ? t.voiceModelHintGemini : t.voiceModelHintOpenAI;
}

export function LlmProfiles({ settings, onUpdate }: LlmProfilesProps) {
  const t = useOptionsText();
  const [selectedId, setSelectedId] = useState<string | null>(
    settings.defaultLlmProfileId ?? settings.llmProfiles[0]?.id ?? null,
  );
  const selected = settings.llmProfiles.find((profile) => profile.id === selectedId) ?? null;
  const [draft, setDraft] = useState<LlmProfile | null>(selected ? cloneProfile(selected) : null);
  const [original, setOriginal] = useState<LlmProfile | null>(
    selected ? cloneProfile(selected) : null,
  );
  const [choosingContract, setChoosingContract] = useState(settings.llmProfiles.length === 0);
  const [keyOrigin, setKeyOrigin] = useState<string | null>(selected ? safeOrigin(selected) : null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<LlmDiagnostic | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState<string>('');

  const dirty = useMemo(
    () => !!draft && (!original || JSON.stringify(draft) !== JSON.stringify(original)),
    [draft, original],
  );

  const discardConfirmed = () => !dirty || window.confirm(t.confirmDiscard);

  const openProfile = (profile: LlmProfile) => {
    if (!discardConfirmed()) return;
    setSelectedId(profile.id);
    setDraft(cloneProfile(profile));
    setOriginal(cloneProfile(profile));
    setKeyOrigin(safeOrigin(profile));
    setChoosingContract(false);
    setNotice(null);
    setDiagnostic(null);
    setDeleteId(null);
  };

  const beginCreate = () => {
    if (!discardConfirmed()) return;
    setSelectedId(null);
    setDraft(null);
    setOriginal(null);
    setChoosingContract(true);
    setNotice(null);
    setDiagnostic(null);
    setDeleteId(null);
  };

  const chooseContract = (apiContract: LlmApiContract) => {
    const profile = createLlmProfile(apiContract);
    setDraft(profile);
    setOriginal(null);
    setKeyOrigin(safeOrigin(profile));
    setChoosingContract(false);
  };

  const changeContract = (apiContract: LlmApiContract) => {
    if (!draft || draft.apiContract === apiContract) return;
    if (original && !window.confirm(t.confirmChangeContract)) {
      return;
    }
    const baseUrl = contractDefaultBaseUrl(apiContract);
    setDraft({
      ...draft,
      apiContract,
      baseUrl,
      model: '',
      modelIds: [],
      discovery: { status: 'untested' },
      ...(contractSupportsVoice(apiContract) ? {} : { voiceModel: '' }),
      dataOriginAcknowledged: undefined,
      insecureOriginAcknowledged: undefined,
    });
    // A contract transition is the deliberate exception to origin-bound key clearing.
    setKeyOrigin(new URL(baseUrl).origin);
    setNotice(draft.apiKey ? t.keyKeptForContract : null);
    setDiagnostic(null);
  };

  const normalizeAndProtectOrigin = () => {
    if (!draft) return;
    const baseUrl = normalizeBaseUrl(draft.baseUrl);
    let origin: string;
    try {
      origin = new URL(baseUrl).origin;
    } catch {
      setDraft({ ...draft, baseUrl });
      return;
    }
    const changed = !!keyOrigin && origin !== keyOrigin;
    setDraft({
      ...draft,
      baseUrl,
      ...(changed
        ? {
            apiKey: '',
            modelIds: [],
            discovery: { status: 'untested' as const },
            dataOriginAcknowledged: undefined,
            insecureOriginAcknowledged: undefined,
          }
        : {}),
    });
    setKeyOrigin(origin);
    if (changed) setNotice(t.keyClearedOriginChanged);
    setDiagnostic(null);
  };

  const acknowledgeInsecureOrigin = (profile: LlmProfile, origin: string): LlmProfile | null => {
    if (!isRemoteHttpOrigin(origin) || profile.insecureOriginAcknowledged === origin)
      return profile;
    const approved = window.confirm(t.confirmInsecure(origin));
    return approved ? { ...profile, insecureOriginAcknowledged: origin } : null;
  };

  const acknowledgeDataOrigin = (profile: LlmProfile, origin: string): LlmProfile | null => {
    if (profile.dataOriginAcknowledged === origin) return profile;
    const approved = window.confirm(t.confirmDataOrigin(origin));
    return approved ? { ...profile, dataOriginAcknowledged: origin } : null;
  };

  const saveProfile = async () => {
    if (!draft) return;
    const normalized = {
      ...draft,
      name: draft.name.trim(),
      baseUrl: normalizeBaseUrl(draft.baseUrl),
      model: draft.model.trim(),
      modelIds: [...new Set([draft.model.trim(), ...draft.modelIds].filter(Boolean))],
    };
    const errors = profileErrors(normalized).map((code) => t.profileError[code]);
    const duplicateName = settings.llmProfiles.some(
      (profile) =>
        profile.id !== normalized.id &&
        profile.name.trim().toLowerCase() === normalized.name.toLowerCase(),
    );
    if (duplicateName) errors.push(t.duplicateName);
    if (errors.length) {
      setNotice(errors.join(' '));
      return;
    }
    const origin = profileOrigin(normalized);
    let ready = acknowledgeInsecureOrigin(normalized, origin);
    if (!ready) return;
    const willBeDefault =
      settings.defaultLlmProfileId === normalized.id || !settings.defaultLlmProfileId;
    if (willBeDefault) ready = acknowledgeDataOrigin(ready, origin);
    if (!ready) return;

    const exists = settings.llmProfiles.some((profile) => profile.id === ready.id);
    const llmProfiles = exists
      ? settings.llmProfiles.map((profile) => (profile.id === ready.id ? ready : profile))
      : [...settings.llmProfiles, ready];
    const defaultLlmProfileId = settings.defaultLlmProfileId ?? ready.id;
    setBusy(true);
    try {
      const next = await onUpdate({ llmProfiles, defaultLlmProfileId });
      const saved = next.llmProfiles.find((profile) => profile.id === ready?.id) ?? ready;
      setSelectedId(saved.id);
      setDraft(cloneProfile(saved));
      setOriginal(cloneProfile(saved));
      setKeyOrigin(safeOrigin(saved));
      setNotice(t.profileSaved);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Chrome rejects rather than returning false when the requested origin is not
   * declared optional in the manifest, so both outcomes have to reach the
   * notice. An unhandled rejection here read as a dead Refresh button.
   * Returns the reason it could not be granted, or null once it is.
   */
  const ensureEndpointPermission = async (profile: LlmProfile): Promise<string | null> => {
    const originPattern = `${profileOrigin(profile)}/*`;
    let granted: boolean;
    try {
      // Called before any await in this click, because Chrome only grants an
      // optional permission while the user's gesture is still live.
      granted = await chrome.permissions.request({ origins: [originPattern] });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      return t.chromeWouldNotRequest(originPattern, reason);
    }
    return granted ? null : t.permissionNotGranted;
  };

  const refreshModels = async () => {
    if (!draft) return;
    try {
      new URL(normalizeBaseUrl(draft.baseUrl));
    } catch {
      setNotice(t.needBaseUrlToRefresh);
      return;
    }
    setBusy(true);
    setDiagnostic(null);
    try {
      const blocked = await ensureEndpointPermission(draft);
      if (blocked) {
        setNotice(blocked);
        return;
      }
      const response = await sendToBackground({ type: 'llm:list-models', profile: draft });
      if (response.ok === false) {
        setNotice(response.error);
        setDiagnostic(response.diagnostic ?? null);
        return;
      }
      if (!('discovery' in response)) return;
      const result = response.discovery;
      const modelIds = [...new Set([...(draft.model ? [draft.model] : []), ...result.models])];
      setDraft({
        ...draft,
        modelIds,
        discovery: {
          status: result.status,
          checkedAt: result.checkedAt,
          message: result.message,
        },
      });
      setDiagnostic(result.diagnostic ?? null);
      // The service worker's wording is English; say the outcomes it knows in
      // the chosen language, and pass a provider's own error text through.
      setNotice(
        result.status === 'available'
          ? t.modelsLoaded(result.models.length)
          : result.status === 'unavailable'
            ? t.modelListUnavailable
            : result.message,
      );
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async () => {
    if (!draft || !original || dirty) {
      setNotice(t.saveBeforeDefault);
      return;
    }
    const origin = profileOrigin(draft);
    const ready = acknowledgeDataOrigin(draft, origin);
    if (!ready) return;
    const llmProfiles = settings.llmProfiles.map((profile) =>
      profile.id === ready.id ? ready : profile,
    );
    setBusy(true);
    try {
      const next = await onUpdate({ llmProfiles, defaultLlmProfileId: ready.id });
      const saved = next.llmProfiles.find((profile) => profile.id === ready.id) ?? ready;
      setDraft(cloneProfile(saved));
      setOriginal(cloneProfile(saved));
      setNotice(t.nowDefault(saved.name));
    } finally {
      setBusy(false);
    }
  };

  const duplicateProfile = () => {
    if (!original || dirty) return;
    const copy: LlmProfile = {
      ...cloneProfile(original),
      id: `profile_${crypto.randomUUID().slice(0, 8)}`,
      name: `${original.name} ${t.copySuffix}`,
      apiKey: '',
      discovery: { status: 'untested' },
      dataOriginAcknowledged: undefined,
      insecureOriginAcknowledged: undefined,
    };
    setSelectedId(null);
    setDraft(copy);
    setOriginal(null);
    setKeyOrigin(safeOrigin(copy));
    setNotice(t.copyNotice);
    setDiagnostic(null);
  };

  const beginDelete = () => {
    if (!draft || !original || dirty) {
      setNotice(original ? t.saveBeforeDelete : t.cancelDraftInstead);
      return;
    }
    const alternatives = settings.llmProfiles.filter((profile) => profile.id !== draft.id);
    setReplacementId(alternatives[0]?.id ?? '');
    setDeleteId(draft.id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const deletingDefault = settings.defaultLlmProfileId === deleteId;
    let llmProfiles = settings.llmProfiles.filter((profile) => profile.id !== deleteId);
    if (deletingDefault && llmProfiles.length > 0 && !replacementId) return;
    if (deletingDefault && replacementId) {
      const replacement = llmProfiles.find((profile) => profile.id === replacementId);
      if (!replacement) return;
      const ready = acknowledgeDataOrigin(replacement, profileOrigin(replacement));
      if (!ready) return;
      llmProfiles = llmProfiles.map((profile) => (profile.id === ready.id ? ready : profile));
    }
    const defaultLlmProfileId = deletingDefault
      ? replacementId || null
      : settings.defaultLlmProfileId;
    setBusy(true);
    try {
      const next = await onUpdate({ llmProfiles, defaultLlmProfileId });
      const replacement =
        next.llmProfiles.find((profile) => profile.id === defaultLlmProfileId) ??
        next.llmProfiles[0] ??
        null;
      setDeleteId(null);
      setSelectedId(replacement?.id ?? null);
      setDraft(replacement ? cloneProfile(replacement) : null);
      setOriginal(replacement ? cloneProfile(replacement) : null);
      setKeyOrigin(replacement ? safeOrigin(replacement) : null);
      setChoosingContract(!replacement);
      setNotice(replacement ? t.profileDeleted : t.profileDeletedNone);
    } finally {
      setBusy(false);
    }
  };

  let endpointPreview = '';
  if (draft) {
    try {
      endpointPreview = profileEndpoint(draft);
    } catch {
      endpointPreview = t.endpointInvalid;
    }
  }

  const alternatives = settings.llmProfiles.filter((profile) => profile.id !== deleteId);

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">{t.connectionsTitle}</h2>
          <p className="card-sub">{t.connectionsSub}</p>
        </div>
        <button type="button" className="btn btn-sm btn-icon" onClick={beginCreate}>
          <PlusIcon size={15} />
          {t.addProfile}
        </button>
      </div>

      <div className="profiles">
        <nav className="profile-list" aria-label={t.profilesNav}>
          {settings.llmProfiles.length === 0 ? (
            <p className="empty-state">{t.noProfiles}</p>
          ) : (
            settings.llmProfiles.map((profile) => (
              <button
                type="button"
                key={profile.id}
                className="profile-row"
                aria-current={profile.id === selectedId}
                onClick={() => openProfile(profile)}
              >
                <span className="profile-row__top">
                  <span className="profile-row__name">{profile.name}</span>
                  {profile.id === settings.defaultLlmProfileId ? (
                    <span className="badge">{t.defaultBadge}</span>
                  ) : null}
                </span>
                <span className="profile-row__meta">{contractLabel(profile.apiContract)}</span>
                <span className="profile-row__meta">{profile.model || t.noModelSelected}</span>
              </button>
            ))
          )}
        </nav>

        <div className="profile-editor">
          {choosingContract ? (
            <>
              <div>
                <h3 className="card-title">{t.chooseContractTitle}</h3>
                <p className="card-sub">{t.chooseContractSub}</p>
              </div>
              <div className="form-stack-sm">
                {LLM_API_CONTRACTS.map((contract) => (
                  <button
                    key={contract}
                    type="button"
                    className="contract-option"
                    onClick={() => chooseContract(contract)}
                  >
                    <strong>{contractLabel(contract)}</strong>
                    <span>{t.contractDescription[contract]}</span>
                  </button>
                ))}
              </div>
            </>
          ) : draft ? (
            <>
              <div className="editor-head">
                <div className="form-stack-sm">
                  <h3>{original ? draft.name || t.untitledProfile : t.newProfile}</h3>
                  <div className="row">
                    <span className={`badge ${DISCOVERY_TONE[draft.discovery.status]}`}>
                      {t.discovery[draft.discovery.status]}
                    </span>
                    {draft.id === settings.defaultLlmProfileId ? (
                      <span className="badge">{t.defaultBadge}</span>
                    ) : null}
                  </div>
                </div>
                {dirty ? <span className="badge badge-warning">{t.unsaved}</span> : null}
              </div>

              <div className="form-stack">
                <Field id="profile-name" label={t.profileName}>
                  <input
                    id="profile-name"
                    className="input"
                    type="text"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </Field>

                <Field id="api-contract" label={t.apiContract}>
                  <SelectWrap>
                    <select
                      id="api-contract"
                      className="input select"
                      value={draft.apiContract}
                      onChange={(event) => changeContract(event.target.value as LlmApiContract)}
                    >
                      {LLM_API_CONTRACTS.map((contract) => (
                        <option key={contract} value={contract}>
                          {contractLabel(contract)}
                        </option>
                      ))}
                    </select>
                  </SelectWrap>
                </Field>

                {draft.apiContract === 'anthropic-messages' ? (
                  <Alert tone="warning" title={t.anthropicTitle}>
                    {t.anthropicBody}
                  </Alert>
                ) : null}

                <Field id="base-url" label={t.baseUrl}>
                  <input
                    id="base-url"
                    className="input"
                    type="url"
                    spellCheck={false}
                    value={draft.baseUrl}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        baseUrl: event.target.value,
                        modelIds: [],
                        discovery: { status: 'untested' },
                      })
                    }
                    onBlur={normalizeAndProtectOrigin}
                  />
                  <p className="field-hint">{t.requestsGoTo}</p>
                  <span className="pill pill-endpoint">{endpointPreview}</span>
                </Field>

                <Field id="api-key" label={t.apiKey} hint={t.apiKeyHint}>
                  <div className="row">
                    <input
                      id="api-key"
                      className="input grow"
                      type={keyVisible ? 'text' : 'password'}
                      autoComplete="off"
                      spellCheck={false}
                      value={draft.apiKey}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          apiKey: event.target.value,
                          modelIds: [],
                          discovery: { status: 'untested' },
                        })
                      }
                      onBlur={() => setKeyVisible(false)}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setKeyVisible((visible) => !visible)}
                    >
                      {keyVisible ? t.hide : t.reveal}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setDraft({ ...draft, apiKey: '' })}
                    >
                      {t.clear}
                    </button>
                  </div>
                  <Switch
                    checked={draft.rememberApiKey}
                    label={t.rememberKey}
                    onChange={(rememberApiKey) => setDraft({ ...draft, rememberApiKey })}
                  />
                </Field>

                <Field id="model" label={t.model} hint={t.modelHint}>
                  <div className="row">
                    <input
                      id="model"
                      className="input grow"
                      type="text"
                      spellCheck={false}
                      value={draft.model}
                      onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-icon"
                      disabled={busy}
                      onClick={() => void refreshModels()}
                    >
                      {busy ? <span className="spinner spinner-sm" /> : null}
                      {busy ? t.checking : t.refreshModels}
                    </button>
                  </div>
                  {draft.modelIds.length > 0 ? (
                    <SelectWrap>
                      <select
                        className="input select input-sm"
                        aria-label={t.discoveredModels}
                        value={draft.modelIds.includes(draft.model) ? draft.model : ''}
                        onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                      >
                        <option value="" disabled>
                          {t.chooseDiscovered(draft.modelIds.length)}
                        </option>
                        {draft.modelIds.map((model) => (
                          <option value={model} key={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </SelectWrap>
                  ) : null}
                </Field>
              </div>

              {contractSupportsVoice(draft.apiContract) ? (
                <Field id="voice-model" label={t.voiceModel} hint={voiceModelHint(draft, t)}>
                  <input
                    id="voice-model"
                    className="input"
                    type="text"
                    spellCheck={false}
                    placeholder={t.voiceModelOptional}
                    value={draft.voiceModel}
                    onChange={(event) => setDraft({ ...draft, voiceModel: event.target.value })}
                  />
                  <SelectWrap>
                    <select
                      className="input select input-sm"
                      aria-label={t.suggestedVoiceModels}
                      value={
                        voiceModelSuggestions(draft).includes(draft.voiceModel)
                          ? draft.voiceModel
                          : ''
                      }
                      onChange={(event) => setDraft({ ...draft, voiceModel: event.target.value })}
                    >
                      <option value="" disabled>
                        {t.chooseSuggested(voiceModelSuggestions(draft).length)}
                      </option>
                      {voiceModelSuggestions(draft).map((model) => (
                        <option value={model} key={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </SelectWrap>
                </Field>
              ) : null}

              <Alert tone="info" title={t.dataDestination}>
                {t.dataDestinationBody(safeOrigin(draft))}
                {voiceEnabled(draft) ? t.audioToo : ''}
              </Alert>

              {notice ? <Alert tone="warning">{notice}</Alert> : null}

              {diagnostic ? (
                <details className="diagnostic">
                  <summary>{t.technicalDetails}</summary>
                  <dl>
                    <dt>{t.endpoint}</dt>
                    <dd>{diagnostic.endpoint}</dd>
                    <dt>{t.apiContract}</dt>
                    <dd>{contractLabel(diagnostic.apiContract)}</dd>
                    {diagnostic.status ? (
                      <>
                        <dt>{t.httpStatus}</dt>
                        <dd>{diagnostic.status}</dd>
                      </>
                    ) : null}
                    {diagnostic.requestId ? (
                      <>
                        <dt>{t.requestId}</dt>
                        <dd>{diagnostic.requestId}</dd>
                      </>
                    ) : null}
                    {diagnostic.responseExcerpt ? (
                      <>
                        <dt>{t.response}</dt>
                        <dd>{diagnostic.responseExcerpt}</dd>
                      </>
                    ) : null}
                  </dl>
                </details>
              ) : null}

              {deleteId ? (
                <Alert tone="danger" title={t.deleteTitle(draft.name)}>
                  <div className="form-stack">
                    {settings.defaultLlmProfileId === deleteId && alternatives.length > 0 ? (
                      <Field id="replacement-profile" label={t.newDefaultProfile}>
                        <SelectWrap>
                          <select
                            id="replacement-profile"
                            className="input select"
                            value={replacementId}
                            onChange={(event) => setReplacementId(event.target.value)}
                          >
                            {alternatives.map((profile) => (
                              <option value={profile.id} key={profile.id}>
                                {profile.name}
                              </option>
                            ))}
                          </select>
                        </SelectWrap>
                      </Field>
                    ) : alternatives.length === 0 ? (
                      <p>{t.blockedUntilCreated}</p>
                    ) : null}
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn-danger btn-icon"
                        disabled={busy}
                        onClick={() => void confirmDelete()}
                      >
                        <TrashIcon size={16} />
                        {t.deleteProfile}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setDeleteId(null)}
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                </Alert>
              ) : (
                <div className="card-footer editor-footer">
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!dirty || busy}
                      onClick={() => void saveProfile()}
                    >
                      {t.saveProfile}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!dirty || busy}
                      onClick={() => {
                        if (original) openProfile(original);
                        else beginCreate();
                      }}
                    >
                      {t.cancel}
                    </button>
                  </div>
                  <div className="row editor-footer__actions">
                    {draft.id !== settings.defaultLlmProfileId ? (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!original || busy}
                        onClick={() => void makeDefault()}
                      >
                        {t.makeDefault}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-sm btn-icon"
                      disabled={!original || dirty || busy}
                      onClick={duplicateProfile}
                    >
                      <CopyIcon size={15} />
                      {t.duplicate}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger btn-icon"
                      disabled={!original || busy}
                      onClick={beginDelete}
                    >
                      <TrashIcon size={15} />
                      {t.delete}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="empty-state">{t.chooseOrAdd}</p>
          )}
        </div>
      </div>
    </section>
  );
}
