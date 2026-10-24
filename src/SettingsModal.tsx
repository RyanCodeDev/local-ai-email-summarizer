import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Radio, X } from "lucide-react";
import { baseUrl, connectionError, loadModels, SETTINGS_KEY } from "./lib/llm";
import type { Settings } from "./lib/llm";

interface Props {
  settings: Settings;
  onSave: (settings: Settings, tested: boolean) => void;
  onClose: () => void;
}
export function SettingsModal({ settings, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(settings);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tested, setTested] = useState(false);
  const [remember, setRemember] = useState(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => controller.current?.abort();
  }, []);
  const update = (key: keyof Settings, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
    if (key !== "model" && key !== "outputMode") {
      controller.current?.abort();
      setLoading(false);
      setModels([]);
      setTested(false);
    }
  };
  async function discover() {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setLoading(true);
    setError("");
    setTested(false);
    try {
      const available = await loadModels(
        draft,
        AbortSignal.any([active.signal, AbortSignal.timeout(15000)]),
      );
      if (active.signal.aborted) return;
      setModels(available);
      setTested(true);
      setDraft((current) => ({
        ...current,
        model: available.includes(current.model) ? current.model : available[0],
      }));
    } catch (err) {
      if (!active.signal.aborted) setError(connectionError(err));
    } finally {
      if (!active.signal.aborted) setLoading(false);
    }
  }
  function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      baseUrl(draft);
      if (!draft.model.trim())
        throw new Error(
          "Load and select a model, or enter a model ID manually.",
        );
      try {
        if (remember) {
          const { apiKey: _secret, ...preferences } = draft;
          void _secret;
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
        } else localStorage.removeItem(SETTINGS_KEY);
      } catch {
        setError(
          "Browser storage is unavailable. Turn off “Remember connection” to use this session only.",
        );
        if (remember) return;
      }
      onSave({ ...draft, model: draft.model.trim() }, tested);
    } catch (err) {
      setError(connectionError(err));
    }
  }
  return (
    <dialog
      ref={dialog}
      className="settings-modal"
      aria-labelledby="settings-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form onSubmit={save}>
        <header className="modal-header">
          <div>
            <span className="eyebrow">YOUR AI, YOUR NETWORK</span>
            <h2 id="settings-title">Connection settings</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <p className="muted">
          Connect directly to an OpenAI-compatible server on this computer or
          your local network.
        </p>
        <div className="connection-fields">
          <label>
            Protocol
            <select
              value={draft.protocol}
              onChange={(e) => update("protocol", e.target.value)}
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
          </label>
          <label className="host-field">
            IP address or hostname
            <input
              autoFocus
              required
              value={draft.host}
              onChange={(e) => update("host", e.target.value)}
              placeholder="192.168.1.20"
            />
          </label>
          <label>
            Port
            <input
              inputMode="numeric"
              value={draft.port}
              onChange={(e) => update("port", e.target.value)}
              placeholder="1234"
            />
          </label>
        </div>
        <label>
          API base path
          <input
            value={draft.path}
            onChange={(e) => update("path", e.target.value)}
            placeholder="/v1"
          />
        </label>
        <label>
          API key <span className="optional">optional · session only</span>
          <input
            type="password"
            autoComplete="off"
            value={draft.apiKey}
            onChange={(e) => update("apiKey", e.target.value)}
            placeholder="Only if your server requires authentication"
          />
        </label>
        <div className="model-heading">
          <label htmlFor="available-models">Available models</label>
          <button
            type="button"
            className="small-button"
            disabled={loading}
            onClick={discover}
          >
            {loading ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <Radio size={14} />
            )}{" "}
            {loading ? "Connecting…" : "Load models"}
          </button>
        </div>
        <select
          id="available-models"
          disabled={!models.length || loading}
          value={models.includes(draft.model) ? draft.model : ""}
          onChange={(e) => update("model", e.target.value)}
        >
          <option value="" disabled>
            Load models from your server
          </option>
          {models.map((model) => (
            <option key={model}>{model}</option>
          ))}
        </select>
        {tested && (
          <p className="success">
            <Check size={14} /> Connected · {models.length} model
            {models.length === 1 ? "" : "s"} available
          </p>
        )}
        <label>
          Model ID{" "}
          <span className="optional">selected above or entered manually</span>
          <input
            value={draft.model}
            onChange={(e) => update("model", e.target.value)}
            placeholder="e.g. qwen3:8b"
          />
        </label>
        <label>
          Output format
          <select
            value={draft.outputMode}
            onChange={(e) => update("outputMode", e.target.value)}
          >
            <option value="json_schema">JSON Schema (recommended)</option>
            <option value="json_object">JSON mode</option>
            <option value="prompt">Prompted JSON (compatibility)</option>
          </select>
        </label>
        <p className="field-help">
          Use JSON Schema when your server and model support it. For other
          servers, try JSON mode or Prompted JSON. Results are always validated
          before display.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />{" "}
          Remember connection on this device
        </label>
        <p className="field-help">
          Only connection preferences, the model, and output format are saved.
          Emails, results, and API keys are never saved by this app. Your server
          controls its own logging.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Save settings <Check size={16} />
          </button>
        </footer>
      </form>
    </dialog>
  );
}
