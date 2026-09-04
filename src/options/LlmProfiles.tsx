import { useMemo, useState } from 'react';

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

  const ensureEndpointPermission = (profile: LlmProfile): Promise<boolean> => {
    const originPattern = `${profileOrigin(profile)}/*`;
    return chrome.permissions.request({ origins: [originPattern] });
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
      if (!(await ensureEndpointPermission(draft))) {
        setNotice('Permission to contact this endpoint was not granted.');
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
    <section className="card ai-connections">
      <div className="section-heading">
        <div>
          <h2 className="card__title">AI connections</h2>
          <p className="card__note">
            Arlo sends each task directly to the default profile. Profiles never switch
            automatically.
          </p>
        </div>
        <button type="button" className="button button--compact" onClick={beginCreate}>
          Add profile
        </button>
      </div>

      <div className="profile-layout">
        <nav className="profile-list" aria-label="AI profiles">
          {settings.llmProfiles.length === 0 ? (
            <p className="empty-state">No profiles yet</p>
          ) : (
            settings.llmProfiles.map((profile) => (
              <button
                type="button"
                className={`profile-row${profile.id === selectedId ? ' profile-row--selected' : ''}`}
                key={profile.id}
                onClick={() => openProfile(profile)}
              >
                <span className="profile-row__top">
                  <strong>{profile.name}</strong>
                  {profile.id === settings.defaultLlmProfileId ? (
                    <span className="badge badge--running">Default</span>
                  ) : null}
                </span>
                <span>{contractLabel(profile.apiContract)}</span>
                <span>{profile.model || 'No model selected'}</span>
                <span className={`status status--${profile.discovery.status}`}>
                  {discoveryLabel(profile)}
                </span>
              </button>
            ))
          )}
        </nav>

        <div className="profile-editor">
          {choosingContract ? (
            <div className="contract-picker">
              <h3>Choose an API contract</h3>
              <p className="card__note">The request and authentication format stays explicit.</p>
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
          ) : draft ? (
            <>
              <div className="editor-heading">
                <div>
                  <h3>{original ? draft.name || 'Untitled profile' : 'New profile'}</h3>
                  <span className={`status status--${draft.discovery.status}`}>
                    {discoveryLabel(draft)}
                  </span>
                </div>
                {dirty ? <span className="unsaved">Unsaved changes</span> : null}
              </div>

              <div className="field-grid">
                <div className="field field--full">
                  <label htmlFor="profile-name">Profile name</label>
                  <input
                    id="profile-name"
                    type="text"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </div>

                <div className="field field--full">
                  <label htmlFor="api-contract">API contract</label>
                  <select
                    id="api-contract"
                    value={draft.apiContract}
                    onChange={(event) => changeContract(event.target.value as LlmApiContract)}
                  >
                    {LLM_API_CONTRACTS.map((contract) => (
                      <option key={contract} value={contract}>
                        {contractLabel(contract)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field field--full">
                  <label htmlFor="base-url">Base URL</label>
                  <input
                    id="base-url"
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
                  <small>
                    Request endpoint: <code>{endpointPreview}</code>
                  </small>
                </div>

                <div className="field field--full">
                  <label htmlFor="api-key">API key</label>
                  <div className="input-with-actions">
                    <input
                      id="api-key"
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
                      className="button button--compact"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setKeyVisible((visible) => !visible)}
                    >
                      {keyVisible ? 'Hide' : 'Reveal'}
                    </button>
                    <button
                      type="button"
                      className="button button--compact"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setDraft({ ...draft, apiKey: '' })}
                    >
                      Clear
                    </button>
                  </div>
                  <label className="switch switch--subtle">
                    <input
                      type="checkbox"
                      checked={draft.rememberApiKey}
                      onChange={(event) =>
                        setDraft({ ...draft, rememberApiKey: event.target.checked })
                      }
                    />
                    Remember key in this Chrome profile
                  </label>
                  <small>
                    Turn this off to keep the key only until Chrome closes. Arlo does not encrypt
                    remembered keys.
                  </small>
                </div>

                <div className="field field--full">
                  <label htmlFor="model">Model</label>
                  <div className="input-with-actions">
                    <input
                      id="model"
                      type="text"
                      list={`models-${draft.id}`}
                      spellCheck={false}
                      value={draft.model}
                      onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                    />
                    <datalist id={`models-${draft.id}`}>
                      {draft.modelIds.map((model) => (
                        <option value={model} key={model} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      className="button button--compact"
                      disabled={busy}
                      onClick={() => void refreshModels()}
                    >
                      {busy ? 'Checking…' : 'Refresh models'}
                    </button>
                  </div>
                  <small>
                    Enter any model ID manually. Refresh only checks the model-list endpoint; it
                    does not run a generation.
                  </small>
                </div>
              </div>

              <div className="privacy-note">
                <strong>Data destination</strong>
                <span>
                  Task instructions and relevant page content go directly to{' '}
                  {safeOrigin(draft) ?? 'the configured origin'}.
                </span>
              </div>

              {notice ? (
                <div className="inline-notice" role="status">
                  {notice}
                </div>
              ) : null}
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
                <div className="delete-confirmation" role="alert">
                  <strong>Delete {draft.name}?</strong>
                  {settings.defaultLlmProfileId === deleteId && alternatives.length > 0 ? (
                    <div className="field">
                      <label htmlFor="replacement-profile">New default profile</label>
                      <select
                        id="replacement-profile"
                        value={replacementId}
                        onChange={(event) => setReplacementId(event.target.value)}
                      >
                        {alternatives.map((profile) => (
                          <option value={profile.id} key={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : alternatives.length === 0 ? (
                    <p>Task submission will be blocked until you create another profile.</p>
                  ) : null}
                  <div className="actions">
                    <button
                      type="button"
                      className="button button--danger"
                      disabled={busy}
                      onClick={() => void confirmDelete()}
                    >
                      Delete profile
                    </button>
                    <button type="button" className="button" onClick={() => setDeleteId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="editor-actions">
                  <div className="actions">
                    <button
                      type="button"
                      className="button button--primary"
                      disabled={!dirty || busy}
                      onClick={() => void saveProfile()}
                    >
                      Save profile
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={!dirty || busy}
                      onClick={() => {
                        if (original) openProfile(original);
                        else beginCreate();
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="actions actions--secondary">
                    {draft.id !== settings.defaultLlmProfileId ? (
                      <button
                        type="button"
                        className="button button--compact"
                        disabled={!original || busy}
                        onClick={() => void makeDefault()}
                      >
                        Make default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button button--compact"
                      disabled={!original || dirty || busy}
                      onClick={duplicateProfile}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="button button--compact button--danger"
                      disabled={!original || busy}
                      onClick={beginDelete}
                    >
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
