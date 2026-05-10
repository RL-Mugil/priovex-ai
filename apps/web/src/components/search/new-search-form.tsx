'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';

const schema = z.object({
  title: z.string().min(5, 'Minimum 5 characters').max(200),
  description: z.string().min(20, 'Minimum 20 characters').max(5000),
  technicalField: z.string().min(3).max(200),
  problemSolved: z.string().min(10).max(2000),
  keyInnovations: z.array(z.string().min(3)).min(1, 'Add at least one innovation'),
  jurisdictions: z.array(z.string()).min(1),
  depth: z.enum(['quick', 'standard', 'thorough']),
  aiProvider: z.enum(['claude', 'openai', 'gemini']),
  reportStyle: z.enum(['legal', 'technical', 'investor', 'concise', 'comprehensive']),
});

type FormData = z.infer<typeof schema>;

const STEPS = [
  { id: 1, title: 'Invention Details', desc: 'Describe what you\'ve invented' },
  { id: 2, title: 'Key Innovations', desc: 'List your novel features' },
  { id: 3, title: 'Search Configuration', desc: 'Configure search parameters' },
];

interface Props {
  remainingSearches: number;
}

export function NewSearchForm({ remainingSearches }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [innovationInput, setInnovationInput] = useState('');

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

  const addInnovation = () => {
    const trimmed = innovationInput.trim();
    if (trimmed && innovations.length < 10) {
      setValue('keyInnovations', [...innovations, trimmed]);
      setInnovationInput('');
    }
  };

  const removeInnovation = (idx: number) => {
    setValue('keyInnovations', innovations.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create search');
      }

      const { searchId } = await res.json();
      router.push(`/dashboard/search/${searchId}`);
    } catch (err) {
      alert((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Step indicator */}
      <div className="flex border-b border-slate-100">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`flex-1 p-4 text-center ${step === s.id ? 'bg-blue-50 border-b-2 border-blue-600' : ''}`}
          >
            <div className={`text-xs font-medium ${step === s.id ? 'text-blue-600' : step > s.id ? 'text-slate-400' : 'text-slate-300'}`}>
              Step {s.id}
            </div>
            <div className={`text-sm font-semibold mt-0.5 ${step === s.id ? 'text-blue-700' : 'text-slate-400'}`}>
              {s.title}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <Field label="Invention Title *" error={errors.title?.message}>
                <input
                  {...form.register('title')}
                  placeholder="e.g., Blockchain-based decentralized authentication system"
                  className="input"
                />
              </Field>

              <Field label="Technical Field *" error={errors.technicalField?.message}>
                <input
                  {...form.register('technicalField')}
                  placeholder="e.g., Cybersecurity, Distributed Systems"
                  className="input"
                />
              </Field>

              <Field label="Detailed Description *" error={errors.description?.message}>
                <textarea
                  {...form.register('description')}
                  rows={5}
                  placeholder="Describe your invention in detail — how it works, its components, the technical mechanism..."
                  className="input resize-none"
                />
                <div className="text-xs text-slate-400 text-right">{watch('description').length}/5000</div>
              </Field>

              <Field label="Problem Solved *" error={errors.problemSolved?.message}>
                <textarea
                  {...form.register('problemSolved')}
                  rows={3}
                  placeholder="What problem or limitation does this invention address?"
                  className="input resize-none"
                />
              </Field>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Key Innovations *
                  <span className="text-slate-400 font-normal ml-2">({innovations.length}/10)</span>
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  List each novel technical feature or aspect of your invention. These are used for search strategy.
                </p>

                {errors.keyInnovations && (
                  <p className="text-xs text-red-500 mb-2">{errors.keyInnovations.message}</p>
                )}

                <div className="flex gap-2 mb-3">
                  <input
                    value={innovationInput}
                    onChange={(e) => setInnovationInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInnovation(); } }}
                    placeholder="e.g., Uses IPFS for distributed key storage"
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={addInnovation}
                    disabled={!innovationInput.trim() || innovations.length >= 10}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {innovations.map((inv, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <span className="text-blue-700 text-sm flex-1">{inv}</span>
                      <button type="button" onClick={() => removeInnovation(idx)} className="text-blue-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="grid grid-cols-2 gap-4">
                <SelectField label="AI Provider" {...form.register('aiProvider')}>
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="openai">GPT-4o (OpenAI)</option>
                  <option value="gemini">Gemini (Google)</option>
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
                            setValue(
                              'jurisdictions',
                              selected ? current.filter((x) => x !== j) : [...current, j]
                            );
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            selected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {j}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
                <strong className="text-slate-900">Summary:</strong>
                <br />
                &quot;{watch('title')}&quot; — {watch('depth')} search using {watch('aiProvider').toUpperCase()}, {watch('reportStyle')} report across {watch('jurisdictions').join(', ')}
              </div>

              {remainingSearches !== Infinity && (
                <p className="text-xs text-slate-500">
                  You have {remainingSearches} search{remainingSearches !== 1 ? 'es' : ''} remaining this month.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 disabled:opacity-0 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-500 transition-colors"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting Search...</>
              ) : (
                <>Start Search</>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1.5">{label}</label>
      <select className="input w-full" {...props}>
        {children}
      </select>
    </div>
  );
}
