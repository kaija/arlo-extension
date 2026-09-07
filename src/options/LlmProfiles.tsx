import { useMemo, useState } from 'react';

import { CopyIcon, PlusIcon, TrashIcon } from '../design-system/icons';
import { sendToBackground, type LlmDiagnostic } from '../shared/messages';
import {
  LLM_API_CONTRACTS,
  contractDefaultBaseUrl,
  contractLabel,
  createLlmProfile,
  isRemoteHttpOrigin,
  normalizeBaseUrl,
  profileEndpoint,
  profileOrigin,
  validateLlmProfile,
  type LlmApiContract,
  type LlmProfile,
  type Settings,
} from '../shared/settings';
import { Alert, Field, SelectWrap, Switch } from './controls';

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

function discoveryLabel(profile: LlmProfile): string {
  switch (profile.discovery.status) {
    case 'available':
      return 'Models loaded';
    case 'unavailable':
      return 'Model list unavailable';
    case 'failed':
      return 'Check failed';
    case 'untested':
      return 'Untested';
  }
}

export function LlmProfiles({ settings, onUpdate }: LlmProfilesProps) {
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

  const discardConfirmed = () => !dirty || window.confirm('Discard your unsaved profile changes?');

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
    if (
      original &&
      !window.confirm(
        'Change this API contract? Arlo will reset the Base URL, model list, and connection status while retaining the API key.',
      )
    ) {
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
      dataOriginAcknowledged: undefined,
      insecureOriginAcknowledged: undefined,
    });
    // A contract transition is the deliberate exception to origin-bound key clearing.
    setKeyOrigin(new URL(baseUrl).origin);
    setNotice(draft.apiKey ? 'The retained key will be sent using the new API contract.' : null);
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
    if (changed)
      setNotice('The stored API key was cleared because the destination origin changed.');
    setDiagnostic(null);
  };

  const acknowledgeInsecureOrigin = (profile: LlmProfile, origin: string): LlmProfile | null => {
    if (!isRemoteHttpOrigin(origin) || profile.insecureOriginAcknowledged === origin)
      return profile;
    const approved = window.confirm(
      `This endpoint uses unencrypted HTTP:\n\n${origin}\n\nAPI keys and page content may be readable in transit. Save it anyway?`,
    );
    return approved ? { ...profile, insecureOriginAcknowledged: origin } : null;
  };

  const acknowledgeDataOrigin = (profile: LlmProfile, origin: string): LlmProfile | null => {
    if (profile.dataOriginAcknowledged === origin) return profile;
    const approved = window.confirm(
      `Allow Arlo to send task instructions and relevant page content directly to:\n\n${origin}?`,
    );
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
    const errors = validateLlmProfile(normalized);
    const duplicateName = settings.llmProfiles.some(
      (profile) =>
        profile.id !== normalized.id &&
        profile.name.trim().toLowerCase() === normalized.name.toLowerCase(),
    );
    if (duplicateName) errors.push('Profile names must be unique.');
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
      setNotice('Profile saved.');
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
      return `Chrome would not request access to ${originPattern}: ${reason}`;
    }
    return granted ? null : 'Permission to contact this endpoint was not granted.';
  };

  const refreshModels = async () => {
    if (!draft) return;
    try {
      new URL(normalizeBaseUrl(draft.baseUrl));
    } catch {
      setNotice('Enter a valid Base URL before refreshing models.');
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
      setNotice(result.message);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async () => {
    if (!draft || !original || dirty) {
      setNotice('Save this profile before making it the default.');
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
      setNotice(`${saved.name} is now the default.`);
    } finally {
      setBusy(false);
    }
  };

  const duplicateProfile = () => {
    if (!original || dirty) return;
    const copy: LlmProfile = {
      ...cloneProfile(original),
      id: `profile_${crypto.randomUUID().slice(0, 8)}`,
      name: `${original.name} Copy`,
      apiKey: '',
      discovery: { status: 'untested' },
      dataOriginAcknowledged: undefined,
      insecureOriginAcknowledged: undefined,
    };
    setSelectedId(null);
    setDraft(copy);
    setOriginal(null);
    setKeyOrigin(safeOrigin(copy));
    setNotice('Enter an API key if this endpoint requires one, then save the copy.');
    setDiagnostic(null);
  };

  const beginDelete = () => {
    if (!draft || !original || dirty) {
      setNotice(
        original ? 'Discard or save your changes before deleting.' : 'Cancel this draft instead.',
      );
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
      setNotice(
        replacement ? 'Profile deleted.' : 'Profile deleted. Tasks are blocked until you add one.',
      );
    } finally {
      setBusy(false);
    }
  };

  let endpointPreview = '';
  if (draft) {
    try {
      endpointPreview = profileEndpoint(draft);
    } catch {
      endpointPreview = 'Enter a valid Base URL to preview the endpoint.';
    }
  }

  const alternatives = settings.llmProfiles.filter((profile) => profile.id !== deleteId);

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">AI connections</h2>
          <p className="card-sub">
            Arlo sends each task directly to the default profile. Profiles never switch
            automatically.
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-icon" onClick={beginCreate}>
          <PlusIcon size={15} />
          Add profile
        </button>
      </div>

      <div className="profiles">
        <nav className="profile-list" aria-label="AI profiles">
          {settings.llmProfiles.length === 0 ? (
            <p className="empty-state">No profiles yet</p>
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
                    <span className="badge">Default</span>
                  ) : null}
                </span>
                <span className="profile-row__meta">{contractLabel(profile.apiContract)}</span>
                <span className="profile-row__meta">{profile.model || 'No model selected'}</span>
              </button>
            ))
          )}
        </nav>

        <div className="profile-editor">
          {choosingContract ? (
            <>
              <div>
                <h3 className="card-title">Choose an API contract</h3>
                <p className="card-sub">The request and authentication format stays explicit.</p>
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
                    <span>
                      {contract === 'anthropic-messages'
                        ? 'Native Claude Messages API'
                        : contract === 'openai-responses'
                          ? 'OpenAI Responses API and compatible gateways'
                          : 'OpenAI Chat Completions and compatible gateways'}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : draft ? (
            <>
              <div className="editor-head">
                <div className="form-stack-sm">
                  <h3>{original ? draft.name || 'Untitled profile' : 'New profile'}</h3>
                  <div className="row">
                    <span className={`badge ${DISCOVERY_TONE[draft.discovery.status]}`}>
                      {discoveryLabel(draft)}
                    </span>
                    {draft.id === settings.defaultLlmProfileId ? (
                      <span className="badge">Default</span>
                    ) : null}
                  </div>
                </div>
                {dirty ? <span className="badge badge-warning">Unsaved changes</span> : null}
              </div>

              <div className="form-stack">
                <Field id="profile-name" label="Profile name">
                  <input
                    id="profile-name"
                    className="input"
                    type="text"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </Field>

                <Field id="api-contract" label="API contract">
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
                  <Alert tone="warning" title="Arlo cannot drive this contract yet">
                    The panel runs its agent on the OpenAI wire formats. An Anthropic profile can
                    still list its models here, but a chat turn will stop with an error. Use an
                    OpenAI Responses or Chat Completions endpoint to run Arlo.
                  </Alert>
                ) : null}

                <Field id="base-url" label="Base URL">
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
                  <p className="field-hint">Requests go to</p>
                  <span className="pill pill-endpoint">{endpointPreview}</span>
                </Field>

                <Field
                  id="api-key"
                  label="API key"
                  hint="Turn remembering off to keep the key only until Chrome closes. Arlo does not encrypt remembered keys."
                >
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
                      {keyVisible ? 'Hide' : 'Reveal'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setDraft({ ...draft, apiKey: '' })}
                    >
                      Clear
                    </button>
                  </div>
                  <Switch
                    checked={draft.rememberApiKey}
                    label="Remember key in this Chrome profile"
                    onChange={(rememberApiKey) => setDraft({ ...draft, rememberApiKey })}
                  />
                </Field>

                <Field
                  id="model"
                  label="Model"
                  hint="Pick a discovered model or type any model ID. Refresh only checks the model-list endpoint; it does not run a generation."
                >
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
                      {busy ? 'Checking…' : 'Refresh models'}
                    </button>
                  </div>
                  {draft.modelIds.length > 0 ? (
                    <SelectWrap>
                      <select
                        className="input select input-sm"
                        aria-label="Discovered models"
                        value={draft.modelIds.includes(draft.model) ? draft.model : ''}
                        onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                      >
                        <option value="" disabled>
                          {`Choose from ${draft.modelIds.length} discovered ${
                            draft.modelIds.length === 1 ? 'model' : 'models'
                          }…`}
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

              <Alert tone="info" title="Data destination">
                Task instructions and relevant page content go directly to{' '}
                {safeOrigin(draft) ?? 'the configured origin'}.
              </Alert>

              {notice ? <Alert tone="warning">{notice}</Alert> : null}

              {diagnostic ? (
                <details className="diagnostic">
                  <summary>Technical details</summary>
                  <dl>
                    <dt>Endpoint</dt>
                    <dd>{diagnostic.endpoint}</dd>
                    <dt>API contract</dt>
                    <dd>{contractLabel(diagnostic.apiContract)}</dd>
                    {diagnostic.status ? (
                      <>
                        <dt>HTTP status</dt>
                        <dd>{diagnostic.status}</dd>
                      </>
                    ) : null}
                    {diagnostic.requestId ? (
                      <>
                        <dt>Request ID</dt>
                        <dd>{diagnostic.requestId}</dd>
                      </>
                    ) : null}
                    {diagnostic.responseExcerpt ? (
                      <>
                        <dt>Response</dt>
                        <dd>{diagnostic.responseExcerpt}</dd>
                      </>
                    ) : null}
                  </dl>
                </details>
              ) : null}

              {deleteId ? (
                <Alert tone="danger" title={`Delete ${draft.name}?`}>
                  <div className="form-stack">
                    {settings.defaultLlmProfileId === deleteId && alternatives.length > 0 ? (
                      <Field id="replacement-profile" label="New default profile">
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
                      <p>Task submission will be blocked until you create another profile.</p>
                    ) : null}
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn-danger btn-icon"
                        disabled={busy}
                        onClick={() => void confirmDelete()}
                      >
                        <TrashIcon size={16} />
                        Delete profile
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setDeleteId(null)}
                      >
                        Cancel
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
                      Save profile
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
                      Cancel
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
                        Make default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-sm btn-icon"
                      disabled={!original || dirty || busy}
                      onClick={duplicateProfile}
                    >
                      <CopyIcon size={15} />
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger btn-icon"
                      disabled={!original || busy}
                      onClick={beginDelete}
                    >
                      <TrashIcon size={15} />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="empty-state">Choose or add a profile.</p>
          )}
        </div>
      </div>
    </section>
  );
}
