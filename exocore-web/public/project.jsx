import { render } from 'solid-js/web';
import { createResource, createSignal, onMount, Show, For } from 'solid-js';
import { Form, Button, Alert, Spinner } from 'solid-bootstrap';

const BASE_URL = '/private/server/exocore/web';

const fetchTemplates = async () => {
  const res = await fetch(`${BASE_URL}/templates`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
};

const checkProjectStatus = async () => {
  try {
    const res = await fetch(`${BASE_URL}/project/status`, { method: 'POST' });
    if (!res.ok) return;
    const json = await res.json();
    if (json.exists) {
      window.location.href = `${BASE_URL}/public/dashboard`;
    }
  } catch (err) {
    console.error('Error checking project status:', err);
  }
};

function App() {
  const [templates, { refetch: refetchTemplates }] = createResource(fetchTemplates);
  const [projectName, setProjectName] = createSignal('');
  const [templateId, setTemplateId] = createSignal('');
  const [gitUrl, setGitUrl] = createSignal('');
  const [inputType, setInputType] = createSignal('template');
  const [status, setStatus] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  onMount(() => {
    checkProjectStatus();

    document.body.style.margin = '0';
    document.body.style.fontFamily = "'Patrick Hand', cursive";
    document.body.style.background = `
      repeating-linear-gradient(
        to bottom,
        #fff8e1 0px,
        #fff8e1 23px,
        #fdf2cc 24px,
        #fff8e1 25px
      ),
      linear-gradient(
        to right,
        transparent 5%,
        #ffab91 5.5%,
        #ffab91 6.5%,
        transparent 7%,
        transparent 100%
      )
    `;
    document.body.style.backgroundRepeat = 'repeat-y';
    document.body.style.backgroundSize = '100% 25px, 100% 100%';
    document.body.style.color = '#444';

    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  });

  const isCreateDisabled = () => {
    if (loading()) return true;
    if (!projectName().trim()) return true; // Check trimmed project name
    if (inputType() === 'template' && !templateId()) return true;
    if (inputType() === 'gitUrl' && !gitUrl().trim()) return true;
    return false;
  };

  const handleCreate = async () => {
    setLoading(true);
    setStatus('');
    const finalProjectName = projectName().trim(); // Use trimmed project name for submission
    if (!finalProjectName) {
        setStatus('Failed: Project name cannot be empty or just spaces.');
        setLoading(false);
        return;
    }

    try {
      const bodyPayload = {
        name: finalProjectName,
        template: inputType() === 'template' ? templateId() : undefined,
        gitUrl: inputType() === 'gitUrl' ? gitUrl().trim() : undefined, // Trim Git URL as well
      };

      const res = await fetch(`${BASE_URL}/project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const text = await res.text();
      if (res.ok) {
        setStatus(`Success: ${text}`);
        setTimeout(() => {
          window.location.href = `${BASE_URL}/public/dashboard`;
        }, 1500);
      } else {
        setStatus(`Failed: ${text || 'Unknown error'}`);
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const commonInputStyle = {
    background: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid #b0bec5',
    'font-size': '1rem',
    'font-family': 'inherit',
    'border-radius': '6px',
    padding: '0.6rem 0.8rem',
  };

  return (
    <div
      style={{
        padding: '2vh 1vw',
        display: 'flex',
        'justify-content': 'center',
        'align-items': 'center',
        'min-height': '100vh',
        'box-sizing': 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          'max-width': '520px',
          'background-color': 'rgba(255, 253, 240, 0.97)',
          'border-radius': '15px',
          border: '1px solid #e0e0e0',
          'box-shadow': '0 6px 18px rgba(0,0,0,0.12)',
          padding: '2rem 2.5rem',
        }}
      >
        <h2
          style={{
            'text-align': 'center',
            'margin-bottom': '2rem',
            'font-size': '2.3rem',
            color: '#2c3e50',
          }}
        >
          ✨ Create New Project ✨
        </h2>

        <Form.Group class="mb-4">
          <Form.Label style={{ 'font-weight': 'bold', color: '#34495e' }}>
            Project Source
          </Form.Label>
          <div style={{ 'margin-top': '0.5rem' }}>
            <Form.Check
              inline
              type="radio"
              label="From Template"
              name="inputType"
              id="inputTypeTemplate"
              value="template"
              checked={inputType() === 'template'}
              onChange={() => setInputType('template')}
              style={{ 'font-family': 'inherit', 'margin-right': '1rem' }}
            />
            <Form.Check
              inline
              type="radio"
              label="From Git URL"
              name="inputType"
              id="inputTypeGitUrl"
              value="gitUrl"
              checked={inputType() === 'gitUrl'}
              onChange={() => setInputType('gitUrl')}
              style={{ 'font-family': 'inherit' }}
            />
          </div>
        </Form.Group>

        <Show
          when={inputType() === 'template'}
          fallback={
            <Form.Group class="mb-4">
              <Form.Label style={{ 'font-weight': 'bold', color: '#34495e' }}>
                Git Repository URL
              </Form.Label>
              <Form.Control
                placeholder="e.g. https://github.com/user/repo.git"
                value={gitUrl()}
                onInput={(e) => setGitUrl(e.currentTarget.value)}
                style={commonInputStyle}
                disabled={loading()}
              />
            </Form.Group>
          }
        >
          <Form.Group class="mb-4">
            <Form.Label style={{ 'font-weight': 'bold', color: '#34495e' }}>Template</Form.Label>
            <Show
              when={!templates.loading && templates()}
              fallback={
                <div style={{ 'text-align': 'center', 'margin-top': '1rem' }}>
                  <Spinner animation="border" variant="secondary" />{' '}
                  <span style={{ 'margin-left': '0.5rem' }}>Loading templates...</span>
                </div>
              }
            >
              <Form.Select
                value={templateId()}
                onInput={(e) => setTemplateId(e.currentTarget.value)}
                style={commonInputStyle}
                disabled={loading()}
              >
                <option value="">-- Choose Template --</option>
                <For each={templates()}>
                  {(template) => <option value={template.id}>{template.name}</option>}
                </For>
              </Form.Select>
            </Show>
            <Show when={templates.error}>
              <Alert variant="danger" class="mt-2" style={{ 'font-family': 'inherit' }}>
                Could not load templates: {templates.error.message}
                <Button
                  variant="link"
                  size="sm"
                  onClick={refetchTemplates}
                  style={{ 'margin-left': '10px', 'font-family': 'inherit' }}
                >
                  Retry
                </Button>
              </Alert>
            </Show>
          </Form.Group>
        </Show>

        <Form.Group class="mb-4">
          <Form.Label style={{ 'font-weight': 'bold', color: '#34495e' }}>Project Name</Form.Label>
          <Form.Control
            placeholder="e.g. my-awesome-app"
            value={projectName()}
            onInput={(e) => setProjectName(e.currentTarget.value.trim())}
            style={commonInputStyle}
            disabled={loading()}
          />
        </Form.Group>

        <Button
          style={{
            width: '100%',
            padding: '0.85rem',
            'font-weight': 'bold',
            'font-size': '1.1rem',
            background: '#ff8c00',
            color: 'white',
            border: 'none',
            'border-radius': '8px',
            'font-family': 'inherit',
            'box-shadow': '0 4px 8px rgba(0,0,0,0.15)',
            transition:
              'transform 0.15s ease-out, box-shadow 0.15s ease-out, background-color 0.15s ease-out',
            cursor: isCreateDisabled() ? 'not-allowed' : 'pointer',
            opacity: isCreateDisabled() ? 0.7 : 1,
          }}
          onClick={handleCreate}
          disabled={isCreateDisabled()}
          onMouseOver={(e) => {
            if (!isCreateDisabled()) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.2)';
              e.currentTarget.style.background = '#e67e00';
            }
          }}
          onMouseOut={(e) => {
            if (!isCreateDisabled()) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              e.currentTarget.style.background = '#ff8c00';
            }
          }}
        >
          {loading() ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
                style={{ 'margin-right': '8px' }}
              />
              Creating...
            </>
          ) : (
            '🚀 Create Project'
          )}
        </Button>

        <Show when={status()}>
          <Alert
            class="mt-4"
            variant={status().startsWith('Success') ? 'success' : 'danger'}
            style={{
              'font-family': 'inherit',
              'text-align': 'center',
              padding: '0.8rem',
              'border-radius': '6px',
            }}
          >
            {status()}
          </Alert>
        </Show>
      </div>
    </div>
  );
}

render(() => <App />, document.getElementById('app'));
