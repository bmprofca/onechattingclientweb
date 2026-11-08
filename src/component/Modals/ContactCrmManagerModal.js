import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import { Encrypt } from '../../pages/encryption/payload-encryption';
import AnimatedModal from './AnimatedModal';
import { FiEdit2, FiPlus, FiTrash2, FiX } from 'react-icons/fi';

const EMPTY_FIELD = { name: '', field_type: 'text', options: '' };

function ContactCrmManagerModal({ isOpen, onClose, tokens, onChanged }) {
  const [tags, setTags] = useState([]);
  const [fields, setFields] = useState([]);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#6366f1');
  const [editingTagId, setEditingTagId] = useState('');
  const [fieldForm, setFieldForm] = useState(EMPTY_FIELD);
  const [editingFieldId, setEditingFieldId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loadRequestId = useRef(0);

  const projectId = tokens?.selected_project_id || tokens?.projects?.[0]?.project_id || '';
  const activeProjectIdRef = useRef(projectId);
  const isOpenRef = useRef(isOpen);
  activeProjectIdRef.current = projectId;
  isOpenRef.current = isOpen;

  const request = useCallback(async (endpoint, payload) => {
    const { data, key } = Encrypt({ project_id: projectId, ...payload });
    const response = await axios.post(
      `${API_BASE_URL}/contact/${endpoint}`,
      JSON.stringify({ data, key }),
      { headers: { token: tokens?.token, username: tokens?.username, 'Content-Type': 'application/json' } }
    );
    if (response?.data?.error) throw new Error(response.data.error);
    return response.data;
  }, [projectId, tokens?.token, tokens?.username]);

  const loadDefinitions = useCallback(async () => {
    if (!isOpenRef.current || !projectId || !tokens?.token || !tokens?.username) return;
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError('');
    setTags([]);
    setFields([]);
    try {
      const [tagResult, fieldResult] = await Promise.all([
        request('tags-list', {}),
        request('custom-fields-list', {})
      ]);
      if (!isOpenRef.current || activeProjectIdRef.current !== projectId) return;
      if (requestId === loadRequestId.current) {
        setTags(Array.isArray(tagResult.data) ? tagResult.data : []);
        setFields(Array.isArray(fieldResult.data) ? fieldResult.data : []);
      }
    } catch (loadError) {
      if (requestId === loadRequestId.current && isOpenRef.current && activeProjectIdRef.current === projectId) {
        setError(loadError.message || 'Failed to load tags and custom fields');
      }
    } finally {
      if (requestId === loadRequestId.current && isOpenRef.current && activeProjectIdRef.current === projectId) {
        setLoading(false);
      }
    }
  }, [projectId, request, tokens?.token, tokens?.username]);

  useEffect(() => {
    if (isOpen) loadDefinitions();
    else loadRequestId.current += 1;
  }, [isOpen, loadDefinitions]);

  const saveTag = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await request(editingTagId ? 'tags-update' : 'tags-create', {
        ...(editingTagId ? { tag_id: editingTagId } : {}),
        name: tagName,
        color: tagColor
      });
      setTagName('');
      setTagColor('#6366f1');
      setEditingTagId('');
      await loadDefinitions();
      onChanged();
    } catch (saveError) {
      setError(saveError.message || 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  const saveField = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...(editingFieldId ? { field_id: editingFieldId } : {}),
        name: fieldForm.name,
        field_type: fieldForm.field_type,
        options: fieldForm.field_type === 'select'
          ? fieldForm.options.split(',').map((option) => option.trim()).filter(Boolean)
          : []
      };
      await request(editingFieldId ? 'custom-fields-update' : 'custom-fields-create', payload);
      setFieldForm(EMPTY_FIELD);
      setEditingFieldId('');
      await loadDefinitions();
      onChanged();
    } catch (saveError) {
      setError(saveError.message || 'Failed to save custom field');
    } finally {
      setSaving(false);
    }
  };

  const deleteDefinition = async (endpoint, id, label) => {
    if (!window.confirm(`Delete ${label}? Existing contact values will no longer be shown.`)) return;
    setSaving(true);
    setError('');
    try {
      await request(endpoint, endpoint === 'tags-delete' ? { tag_id: id } : { field_id: id });
      await loadDefinitions();
      onChanged();
    } catch (deleteError) {
      setError(deleteError.message || `Failed to delete ${label}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatedModal open={isOpen}>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Manage tags and custom fields</h2>
                <p className="mt-1 text-sm text-gray-500">Definitions are saved separately for this project.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded p-2 text-gray-500 hover:bg-gray-100">
                <FiX />
              </button>
            </div>

            {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {loading ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading CRM definitions…</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                <section className="space-y-4">
                  <h3 className="font-semibold text-gray-800">Tags</h3>
                  <form onSubmit={saveTag} className="flex flex-wrap gap-2">
                    <input
                      required
                      maxLength={80}
                      value={tagName}
                      onChange={(event) => setTagName(event.target.value)}
                      placeholder="Tag name"
                      className="oc-input min-w-0 flex-1"
                    />
                    <input
                      type="color"
                      value={tagColor}
                      onChange={(event) => setTagColor(event.target.value)}
                      aria-label="Tag color"
                      className="h-10 w-12 rounded border border-gray-300 p-1"
                    />
                    <button disabled={saving} className="oc-btn-primary">
                      <FiPlus className="mr-1" />{editingTagId ? 'Update' : 'Add tag'}
                    </button>
                    {editingTagId && (
                      <button type="button" onClick={() => { setEditingTagId(''); setTagName(''); setTagColor('#6366f1'); }} className="oc-btn">
                        Cancel
                      </button>
                    )}
                  </form>
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {tags.length === 0 && <li className="px-3 py-4 text-sm text-gray-500">No tags yet.</li>}
                    {tags.map((tag) => (
                      <li key={tag.tag_id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2 truncate text-sm">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <button type="button" aria-label={`Edit ${tag.name}`} onClick={() => { setEditingTagId(tag.tag_id); setTagName(tag.name); setTagColor(tag.color); }} className="rounded p-2 hover:bg-gray-100"><FiEdit2 /></button>
                          <button type="button" aria-label={`Delete ${tag.name}`} disabled={saving} onClick={() => deleteDefinition('tags-delete', tag.tag_id, `tag "${tag.name}"`)} className="rounded p-2 text-red-600 hover:bg-red-50"><FiTrash2 /></button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="space-y-4">
                  <h3 className="font-semibold text-gray-800">Custom fields</h3>
                  <form onSubmit={saveField} className="space-y-2 rounded-lg border border-gray-200 p-3">
                    <input
                      required
                      maxLength={120}
                      value={fieldForm.name}
                      onChange={(event) => setFieldForm((previous) => ({ ...previous, name: event.target.value }))}
                      placeholder="Field name"
                      className="oc-input w-full"
                    />
                    <select
                      value={fieldForm.field_type}
                      onChange={(event) => setFieldForm((previous) => ({ ...previous, field_type: event.target.value }))}
                      className="oc-input w-full"
                    >
                      {['text', 'number', 'date', 'boolean', 'select'].map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
                    </select>
                    {fieldForm.field_type === 'select' && (
                      <input
                        required
                        value={fieldForm.options}
                        onChange={(event) => setFieldForm((previous) => ({ ...previous, options: event.target.value }))}
                        placeholder="Options separated by commas"
                        className="oc-input w-full"
                      />
                    )}
                    <div className="flex gap-2">
                      <button disabled={saving} className="oc-btn-primary">
                        <FiPlus className="mr-1" />{editingFieldId ? 'Update field' : 'Add field'}
                      </button>
                      {editingFieldId && (
                        <button type="button" onClick={() => { setEditingFieldId(''); setFieldForm(EMPTY_FIELD); }} className="oc-btn">Cancel</button>
                      )}
                    </div>
                  </form>
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {fields.length === 0 && <li className="px-3 py-4 text-sm text-gray-500">No custom fields yet.</li>}
                    {fields.map((field) => (
                      <li key={field.field_id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{field.name}</span>
                          <span className="block text-xs text-gray-500">{field.field_type} · {'{{' + field.field_key + '}}'}</span>
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={`Edit ${field.name}`}
                            onClick={() => {
                              setEditingFieldId(field.field_id);
                              setFieldForm({ name: field.name, field_type: field.field_type, options: (field.options || []).join(', ') });
                            }}
                            className="rounded p-2 hover:bg-gray-100"
                          ><FiEdit2 /></button>
                          <button type="button" aria-label={`Delete ${field.name}`} disabled={saving} onClick={() => deleteDefinition('custom-fields-delete', field.field_id, `field "${field.name}"`)} className="rounded p-2 text-red-600 hover:bg-red-50"><FiTrash2 /></button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </AnimatedModal>
  );
}

export default ContactCrmManagerModal;
