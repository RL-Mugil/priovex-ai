'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, ChevronRight, ChevronLeft, Loader2, AlertCircle, FileUp } from 'lucide-react';

const schema = z.object({
  title: z.string().min(5, 'At least 5 characters').max(200),
  description: z.string().min(10, 'At least 10 characters').max(5000),
  technicalField: z.string().min(2, 'At least 2 characters').max(200),
  problemSolved: z.string().min(5, 'At least 5 characters').max(2000),
  keyInnovations: z.array(z.string().min(2)).min(1, 'Add at least one key innovation'),
  jurisdictions: z.array(z.string()).min(1, 'Select at least one jurisdiction'),
  depth: z.enum(['quick', 'standard', 'thorough']),
  aiProvider: z.enum(['claude', 'openai', 'gemini']),
  reportStyle: z.enum(['legal', 'technical', 'investor', 'concise', 'comprehensive']),
});

type FormData = z.infer<typeof schema>;

const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
  1: ['title', 'technicalField', 'description', 'problemSolved'],
  2: ['keyInnovations'],
  3: ['depth', 'aiProvider', 'reportStyle', 'jurisdictions'],
};

interface Props {
  remainingSearches: number;
}

export function NewSearchForm({ remainingSearches }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [innovationInput, setInnovationInput] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      technicalField: '',
      problemSolved: '',
      keyInnovations: [],
      jurisdictions: ['US'],
      depth: 'standard',
      aiProvider: 'claude',
      reportStyle: 'comprehensive',
    },
  });

  const { watch, setValue, getValues, formState: { errors } } = form;
  const innovations = watch('keyInnovations');

  function addInnovation() {
    const trimmed = innovationInput.trim();
    if (trimmed && innovations.length < 10) {
      setValue('keyInnovations', [...innovations, trimmed], { shouldValidate: true });
      setInnovationInput('');
    }
  }

  function removeInnovation(idx: number) {
    setValue('keyInnovations', innovations.filter((_, i) => i !== idx), { shouldValidate: true });
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfError('');
    setPdfLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/extract-pdf', { method: 'POST', body: fd });
      const data = await res.json() as {
        title?: string; technicalField?: string; description?: string;
        problemSolved?: string; keyInnovations?: string[]; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed');
      if (data.title) setValue('title', data.title, { shouldValidate: true });
      if (data.technicalField) setValue('technicalField', data.technicalField, { shouldValidate: true });
      if (data.description) setValue('description', data.description, { shouldValidate: true });
      if (data.problemSolved) setValue('problemSolved', data.problemSolved, { shouldValidate: true });
      if (data.keyInnovations?.length) setValue('keyInnovations', data.keyInnovations, { shouldValidate: true });
    } catch (err) {
      setPdfError((err as Error).message);
    } finally {
      setPdfLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function goNext() {
    // Auto-add pending innovation text before advancing from step 2
    if (step === 2 && innovationInput.trim()) {
      const trimmed = innovationInput.trim();
      const updated = [...innovations, trimmed];
      setValue('keyInnovations', updated, { shouldValidate: true });
      setInnovationInput('');
      // Give state time to update before triggering validation
      await new Promise((r) => setTimeout(r, 50));
    }

    const valid = await form.trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => s + 1);
  }

  async function handleSubmit(data: FormData) {
    // Auto-add any pending innovation text the user forgot to click "+"
    if (innovationInput.trim() && data.keyInnovations.length === 0) {
      data.keyInnovations = [innovationInput.trim()];
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string; details?: unknown };
        throw new Error(err.error ?? 'Failed to create search');
      }

      const { searchId } = await res.json() as { searchId: string };
      router.push(`/dashboard/search/${searchId}`);
    } catch (err) {
      setSubmitError((err as Error).message);
      setSubmitting(false);
    }
  }

  // Collect all validation errors across all steps for the submit-time summary
  const allErrors = Object.values(errors);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Step indicator */}
      <div className="flex border-b border-slate-100">
        {[
          { id: 1, title: 'Invention Details' },
          { id: 2, title: 'Key Innovations' },
          { id: 3, title: 'Search Settings' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => step > s.id && setStep(s.id)}
            className={`flex-1 p-4 text-center transition-colors ${
              step === s.id ? 'bg-blue-50 border-b-2 border-blue-600' :
              step > s.id ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
            }`}
          >
            <div className={`text-xs font-medium ${
              step === s.id ? 'text-blue-600' : step > s.id ? 'text-emerald-600' : 'text-slate-300'
            }`}>
              Step {s.id} {step > s.id ? '✓' : ''}
            </div>
            <div className={`text-sm font-semibold mt-0.5 ${
              step === s.id ? 'text-blue-700' : step > s.id ? 'text-slate-600' : 'text-slate-300'
            }`}>
              {s.title}
            </div>
          </button>
        ))}
      </div>

      <form
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        className="p-6"
      >
        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            {/* PDF Upload */}
            <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-700">Have an invention disclosure or patent draft?</p>
                <p className="text-xs text-slate-400 mt-0.5">Upload a PDF and we&apos;ll auto-fill the fields below.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {pdfLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                <button
                  type="button"
                  disabled={pdfLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <FileUp className="w-4 h-4" />
                  {pdfLoading ? 'Extracting…' : 'Upload PDF'}
                </button>
              </div>
            </div>
            {pdfError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {pdfError}
              </div>
            )}

            <Field label="Invention Title *" error={errors.title?.message}>
              <input
                {...form.register('title')}
                placeholder="e.g., AI-based soil moisture sensor with edge ML inference"
                className="input"
                autoFocus
              />
            </Field>

            <Field label="Technical Field *" error={errors.technicalField?.message}>
              <input
                {...form.register('technicalField')}
                placeholder="e.g., AgriTech, IoT, Edge AI, Medical Devices"
                className="input"
              />
            </Field>

            <Field label="Detailed Description *" error={errors.description?.message}>
              <textarea
                {...form.register('description')}
                rows={5}
                placeholder="Describe your invention in detail — how it works, its components, the technical mechanism, what makes it unique..."
                className="input resize-none"
              />
              <div className="text-xs text-slate-400 text-right mt-1">{watch('description').length}/5000</div>
            </Field>

            <Field label="Problem Solved *" error={errors.problemSolved?.message}>
              <textarea
                {...form.register('problemSolved')}
                rows={3}
                placeholder="What problem or limitation does this invention address?"
                className="input resize-none"
              />
            </Field>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Key Innovations *
                <span className="text-slate-400 font-normal ml-2">({innovations.length}/10 added)</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">
                List each novel technical feature. Press <kbd className="bg-slate-100 px-1 rounded text-xs">Enter</kbd> or click <strong>+</strong> to add each one.
              </p>

              {errors.keyInnovations && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.keyInnovations.message}
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <input
                  value={innovationInput}
                  onChange={(e) => setInnovationInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInnovation(); } }}
                  placeholder="e.g., Uses federated learning to personalize without sharing raw data"
                  className="input flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={addInnovation}
                  disabled={!innovationInput.trim() || innovations.length >= 10}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 min-h-[40px]">
                {innovations.length === 0 && (
                  <p className="text-sm text-slate-400 italic text-center py-4 border border-dashed border-slate-200 rounded-lg">
                    No innovations added yet — type above and press Enter
                  </p>
                )}
                {innovations.map((inv, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <span className="text-xs text-blue-400 font-mono shrink-0">{String.fromCharCode(97 + idx)}.</span>
                    <span className="text-blue-800 text-sm flex-1">{inv}</span>
                    <button type="button" onClick={() => removeInnovation(idx)} className="text-blue-300 hover:text-red-500 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="AI Provider" {...form.register('aiProvider')}>
                <option value="claude">Claude Sonnet (Anthropic)</option>
                <option value="openai">GPT-4o (OpenAI)</option>
                <option value="gemini">Gemini Flash (Google)</option>
              </SelectField>

              <SelectField label="Search Depth" {...form.register('depth')}>
                <option value="quick">Quick (15–20 min)</option>
                <option value="standard">Standard (25–35 min)</option>
                <option value="thorough">Thorough (45–60 min)</option>
              </SelectField>

              <SelectField label="Report Style" {...form.register('reportStyle')}>
                <option value="comprehensive">Comprehensive</option>
                <option value="legal">Legal (Attorney-ready)</option>
                <option value="technical">Technical</option>
                <option value="investor">Investor-friendly</option>
                <option value="concise">Concise</option>
              </SelectField>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Jurisdictions</label>
                <div className="flex flex-wrap gap-1.5">
                  {['US', 'EP', 'WO', 'CN', 'JP', 'KR'].map((j) => {
                    const selected = watch('jurisdictions').includes(j);
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={() => {
                          const current = getValues('jurisdictions');
                          const updated = selected ? current.filter((x) => x !== j) : [...current, j];
                          if (updated.length > 0) setValue('jurisdictions', updated, { shouldValidate: true });
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {j}
                      </button>
                    );
                  })}
                </div>
                {errors.jurisdictions && <p className="text-xs text-red-500 mt-1">{errors.jurisdictions.message}</p>}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 space-y-1">
              <p><strong className="text-slate-900">Title:</strong> {watch('title')}</p>
              <p><strong className="text-slate-900">Field:</strong> {watch('technicalField')}</p>
              <p><strong className="text-slate-900">Innovations:</strong> {innovations.length} listed</p>
              <p><strong className="text-slate-900">Config:</strong> {watch('depth')} depth · {watch('aiProvider').toUpperCase()} · {watch('reportStyle')} report · {watch('jurisdictions').join(', ')}</p>
            </div>

            {remainingSearches !== Infinity && (
              <p className="text-xs text-slate-500">
                You have <strong>{remainingSearches}</strong> search{remainingSearches !== 1 ? 'es' : ''} remaining this month.
              </p>
            )}

            {/* Show all validation errors at submit time */}
            {allErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Please fix these before submitting:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {errors.title && <li className="text-xs text-red-600">Title: {errors.title.message}</li>}
                  {errors.description && <li className="text-xs text-red-600">Description: {errors.description.message}</li>}
                  {errors.technicalField && <li className="text-xs text-red-600">Technical field: {errors.technicalField.message}</li>}
                  {errors.problemSolved && <li className="text-xs text-red-600">Problem solved: {errors.problemSolved.message}</li>}
                  {errors.keyInnovations && <li className="text-xs text-red-600">Key innovations: {errors.keyInnovations.message}</li>}
                </ul>
              </div>
            )}

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 disabled:opacity-0 transition-colors px-2 py-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-500 transition-colors"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={form.handleSubmit(handleSubmit)}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-500 disabled:opacity-60 transition-colors min-w-[150px] justify-center"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting Search…</>
              ) : (
                'Start Search'
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1.5">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

function SelectField({
  label, children, ...props
}: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1.5">{label}</label>
      <select className="input w-full" {...props}>{children}</select>
    </div>
  );
}
