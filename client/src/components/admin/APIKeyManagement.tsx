import React, { useEffect, useState } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface APIKey {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

interface NewAPIKey {
  id: number;
  name: string;
  key: string;
  prefix: string;
  created_at: string;
  message: string;
}

const APIKeyManagement: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<NewAPIKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Fetch API keys on component mount
  useEffect(() => {
    fetchAPIKeys();
  }, []);

  const fetchAPIKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/api-keys/list`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setApiKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateAPIKey = async () => {
    if (!newKeyName.trim()) {
      setError('Please enter a name for the API key');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/api-keys/generate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: newKeyName }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate API key');
      }

      const data: NewAPIKey = await response.json();
      setCreatedKey(data);
      setNewKeyName('');
      setShowNewKeyModal(false);
      await fetchAPIKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const deleteAPIKey = async (id: number) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/api-keys/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }

      await fetchAPIKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleAPIKey = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/api-keys/${id}/toggle`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to toggle API key status');
      }

      await fetchAPIKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Key className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">API Key Management</h1>
                <p className="text-gray-600 mt-1">
                  Manage API keys for external device authentication
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNewKeyModal(true)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors shadow-md"
              disabled={loading}
            >
              <Plus className="w-5 h-5" />
              <span>Generate New Key</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Created Key Modal */}
        {createdKey && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-8">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-green-100 p-3 rounded-full">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">API Key Created!</h2>
                  <p className="text-gray-600">Store this key securely - it won't be shown again</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 text-sm font-medium">
                  ⚠️ Important: Copy this API key now. For security reasons, you won't be able to
                  see it again.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <p className="text-gray-900 font-semibold">{createdKey.name}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-3 font-mono text-sm break-all">
                    {showKey ? createdKey.key : '••••••••••••••••••••••••••••••••••••••••'}
                  </div>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="p-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(createdKey.key)}
                    className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedKey ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">How to use this API key:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                  <li>
                    Include the API key in the{' '}
                    <code className="bg-blue-100 px-1 rounded">x-api-key</code> header
                  </li>
                  <li>Make requests to any protected endpoint</li>
                  <li>
                    Example:{' '}
                    <code className="bg-blue-100 px-1 rounded">
                      x-api-key: {createdKey.prefix}...
                    </code>
                  </li>
                </ol>
              </div>

              <button
                onClick={() => {
                  setCreatedKey(null);
                  setShowKey(false);
                  setCopiedKey(false);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors font-medium"
              >
                I've Saved the Key
              </button>
            </div>
          </div>
        )}

        {/* New Key Modal */}
        {showNewKeyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Generate New API Key</h2>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="e.g., Mobile App Key, Production Server"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowNewKeyModal(false);
                    setNewKeyName('');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={generateAPIKey}
                  disabled={loading || !newKeyName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Keys List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Your API Keys</h2>
              <button
                onClick={fetchAPIKeys}
                disabled={loading}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {loading && apiKeys.length === 0 ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading API keys...</p>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="p-12 text-center">
              <Key className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No API keys yet</p>
              <p className="text-gray-500 text-sm">Generate your first API key to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Key Prefix
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Used
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {apiKeys.map(key => (
                    <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{key.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{key.prefix}</code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(key.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(key.last_used_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            key.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {key.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => toggleAPIKey(key.id)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                          disabled={loading}
                        >
                          {key.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => deleteAPIKey(key.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Usage Guide */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">API Key Usage Guide</h2>
          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="font-semibold mb-2">Making Requests with API Keys</h3>
              <p className="text-sm mb-2">Include your API key in the request header:</p>
              <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-sm overflow-x-auto">
                {`curl -H "x-api-key: your_api_key_here" \\
     ${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/users`}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Python Example</h3>
              <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-sm overflow-x-auto">
                {`import requests

headers = {"x-api-key": "your_api_key_here"}
response = requests.get(
    "${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/users",
    headers=headers
)
print(response.json())`}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Security Best Practices</h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Never share your API keys publicly or commit them to version control</li>
                <li>Store API keys securely using environment variables or secrets management</li>
                <li>Rotate API keys regularly for enhanced security</li>
                <li>Delete API keys that are no longer needed</li>
                <li>Monitor the "Last Used" timestamp to detect unusual activity</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIKeyManagement;
