'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { Category } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  CategoryIcon,
  AVAILABLE_CATEGORY_ICONS,
  AVAILABLE_COLORS,
} from '@/components/expense/CategoryIcon';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Sparkles,
  Tag,
  Palette,
  AlertCircle,
  FolderPlus,
} from 'lucide-react';

export function CategoryManagement() {
  const { user } = useAuth();
  const userId = user?.id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // New Category State
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#F7931A');
  const [newIcon, setNewIcon] = useState('Tag');
  const [addError, setAddError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#F7931A');
  const [editIcon, setEditIcon] = useState('Tag');
  const [editError, setEditError] = useState('');

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await StorageService.getCategories(userId);
      const { unique } = StorageService.deduplicateCategories(cats);
      setCategories(unique);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadCategories();

    const handleUpdate = () => {
      loadCategories();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-categories-updated', handleUpdate);
      return () => {
        window.removeEventListener('savemoney-categories-updated', handleUpdate);
      };
    }
  }, [loadCategories]);

  const dispatchUpdate = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('savemoney-categories-updated'));
    }
  };

  // Handle Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setAddError('Category name is required');
      return;
    }

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setAddError(`Category "${trimmed}" already exists`);
      return;
    }

    setAddError('');
    setIsSubmitting(true);
    try {
      const created = await StorageService.createCategory(
        {
          name: trimmed,
          color: newColor,
          icon: newIcon,
        },
        userId
      );
      setCategories((prev) => [...prev, created]);
      setNewName('');
      setIsAdding(false);
      dispatchUpdate();
    } catch (err) {
      console.error('Failed to add category:', err);
      setAddError('Failed to save category. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start Editing
  const startEditing = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || '#F7931A');
    setEditIcon(cat.icon || 'Tag');
    setEditError('');
  };

  // Cancel Editing
  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditError('');
  };

  // Save Edit
  const handleSaveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('Category name cannot be empty');
      return;
    }

    if (
      categories.some(
        (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setEditError(`Category "${trimmed}" already exists`);
      return;
    }

    try {
      await StorageService.updateCategory(
        id,
        {
          name: trimmed,
          color: editColor,
          icon: editIcon,
        },
        userId
      );

      setCategories((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, name: trimmed, color: editColor, icon: editIcon }
            : c
        )
      );
      setEditingId(null);
      dispatchUpdate();
    } catch (err) {
      console.error('Failed to update category:', err);
      setEditError('Failed to update category');
    }
  };

  // Handle Delete
  const handleDeleteCategory = async (id: string, name: string) => {
    if (categories.length <= 1) {
      alert('You must have at least one category.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${name}"? Existing expenses in this category will keep their label.`)) {
      return;
    }

    try {
      await StorageService.deleteCategory(id, userId);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      dispatchUpdate();
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category');
    }
  };

  const selectableIcons = Object.keys(AVAILABLE_CATEGORY_ICONS);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Expense Categories"
        subtitle="Add, rename, or delete categories to suit your spending habits"
        action={
          !isAdding && (
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5 text-brand-primary" />}
              onClick={() => setIsAdding(true)}
            >
              Add Category
            </Button>
          )
        }
      />

      {/* Add New Category Panel */}
      {isAdding && (
        <form
          onSubmit={handleAddCategory}
          className="p-4 mb-4 rounded-xl border border-brand-primary/30 bg-brand-light/30 dark:bg-brand-primary/10 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4" /> New Category
            </h4>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setAddError('');
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Category Name"
                placeholder="e.g. Groceries, Gym, Coffee"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              {addError && (
                <p className="mt-1.5 text-xs text-rose-500 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {addError}
                </p>
              )}
            </div>

            {/* Color Swatch Picker */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Accent Color
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {AVAILABLE_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNewColor(col)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      newColor === col ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: col }}
                    title={col}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Select Icon
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-32 overflow-y-auto">
              {selectableIcons.map((iconKey) => {
                const isSelected = newIcon === iconKey;
                return (
                  <button
                    key={iconKey}
                    type="button"
                    onClick={() => setNewIcon(iconKey)}
                    className={`p-2 rounded-lg text-xs flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-brand-primary text-white font-bold shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={iconKey}
                  >
                    <CategoryIcon icon={iconKey} className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setAddError('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              icon={<Check className="w-3.5 h-3.5" />}
            >
              Create Category
            </Button>
          </div>
        </form>
      )}

      {/* Categories List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="p-6 text-center text-xs text-slate-400">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">No categories found.</div>
        ) : (
          categories.map((cat) => {
            const isEditing = editingId === cat.id;

            if (isEditing) {
              return (
                <div
                  key={cat.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 my-2 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-navy-900 dark:text-white">
                      Edit Category
                    </span>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Input
                        label="Name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      {editError && (
                        <p className="mt-1 text-xs text-rose-500 font-medium">{editError}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Color
                      </label>
                      <div className="flex flex-wrap gap-2 items-center">
                        {AVAILABLE_COLORS.map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setEditColor(col)}
                            className={`w-5 h-5 rounded-full transition-transform ${
                              editColor === col
                                ? 'scale-125 ring-2 ring-offset-2 ring-slate-400'
                                : 'hover:scale-110'
                            }`}
                            style={{ backgroundColor: col }}
                            title={col}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Icon options */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Icon
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-24 overflow-y-auto">
                      {selectableIcons.map((iconKey) => {
                        const isSelected = editIcon === iconKey;
                        return (
                          <button
                            key={iconKey}
                            type="button"
                            onClick={() => setEditIcon(iconKey)}
                            className={`p-1.5 rounded-lg text-xs flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-brand-primary text-white font-bold'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={iconKey}
                          >
                            <CategoryIcon icon={iconKey} className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={cancelEditing}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Check className="w-3.5 h-3.5" />}
                      onClick={() => handleSaveEdit(cat.id)}
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={cat.id}
                className="py-3 px-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0"
                    style={{ backgroundColor: cat.color || '#F7931A' }}
                  >
                    <CategoryIcon name={cat.name} icon={cat.icon} className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-navy-900 dark:text-white">
                      {cat.name}
                    </p>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {cat.icon || 'Tag'} • {cat.color || '#F7931A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => startEditing(cat)}
                    className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-brand-light/50 dark:hover:bg-brand-primary/10 rounded-lg transition-colors"
                    title="Rename / Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
