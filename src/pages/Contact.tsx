import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ArrowRight, CheckCircle2, Copy, Loader2, Mail } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Seo } from '../components/site/Seo';
import { SITE } from '../config/site';

const PROJECT_TYPES = ['Jewellery Virtual Try-On', '3D Watch Configurator', 'Clothing Customization', 'Curtain Visualization', 'Custom 3D Experience', 'Other'];
const BUDGETS = ['Under ₹5 lakh', '₹5–15 lakh', '₹15–40 lakh', '₹40 lakh+', 'Not sure yet'];

interface Form {
  name: string;
  email: string;
  company: string;
  phone: string;
  projectType: string;
  budget: string;
  description: string;
  /** honeypot: real people never see or fill this */
  website: string;
}
const EMPTY: Form = { name: '', email: '', company: '', phone: '', projectType: '', budget: '', description: '', website: '' };
type Errors = Partial<Record<keyof Form, string>>;
type Outcome = { kind: 'sent' } | { kind: 'mail' } | { kind: 'unconfigured' } | { kind: 'error'; message: string };

function validate(f: Form): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = 'Please enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Please enter a valid email address.';
  if (f.phone.trim() && !/^[+()\d\s-]{7,20}$/.test(f.phone.trim())) e.phone = 'Please enter a valid phone number, or leave this blank.';
  if (!f.projectType) e.projectType = 'Please choose a project type.';
  if (!f.budget) e.budget = 'Please choose a budget range.';
  if (f.description.trim().length < 20) e.description = 'Please tell us a little more (at least 20 characters).';
  return e;
}

const summarize = (f: Form) =>
  [`Name: ${f.name}`, `Email: ${f.email}`, f.company ? `Company: ${f.company}` : false, f.phone ? `Phone: ${f.phone}` : false, `Project type: ${f.projectType}`, `Budget: ${f.budget}`, '', f.description].filter((x) => x !== false).join('\n');

export default function Contact() {
  const [params] = useSearchParams();
  // other pages can start an inquiry about something specific: /contact?about=...
  const [form, setForm] = useState<Form>(() => {
    const about = params.get('about')?.slice(0, 200);
    return about ? { ...EMPTY, description: `I would like a quote for: ${about}.\n\n` } : EMPTY;
  });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: validate({ ...form, [k]: v })[k] }));
  };
  const blur = (k: keyof Form) => setErrors((e) => ({ ...e, [k]: validate(form)[k] }));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const found = validate(form);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (form.website) return; // bot
    setBusy(true);
    setOutcome(null);
    try {
      if (SITE.contactEndpoint) {
        const { website: _hp, ...payload } = form;
        const res = await fetch(SITE.contactEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`The server responded with ${res.status}.`);
        setOutcome({ kind: 'sent' });
        setForm(EMPTY);
      } else if (SITE.contactEmail) {
        const subject = encodeURIComponent(`Project inquiry: ${form.projectType}`);
        window.location.href = `mailto:${SITE.contactEmail}?subject=${subject}&body=${encodeURIComponent(summarize(form))}`;
        setOutcome({ kind: 'mail' });
      } else {
        setOutcome({ kind: 'unconfigured' });
      }
    } catch (e) {
      setOutcome({ kind: 'error', message: (e as Error).message || 'Your inquiry could not be sent.' });
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summarize(form));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <Seo title="Contact" description="Tell us about your product. Start a project inquiry for virtual try-on, 3D configurators, clothing customization or room visualization." path="/contact" />
      <section className="grain bg-[radial-gradient(ellipse_at_85%_0%,#ffffff,#fbf8f3_50%,#f2ece2)]">
        <div className="container-lux grid grid-cols-[minmax(0,1fr)] gap-12 py-14 lg:grid-cols-[0.85fr_1.15fr] lg:py-20">
          <div>
            <p className="eyebrow">Contact</p>
            <h1 className="display mt-4 text-[52px] leading-[0.98] sm:text-7xl">Let’s build something <span className="text-gold italic">remarkable.</span></h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-cocoa sm:text-base">Tell us what you sell and what you’d like shoppers to do with it. We’ll come back with an approach that fits your catalogue and budget.</p>
            <ol className="mt-10 space-y-5 border-t border-line pt-8">
              {[
                ['We review your inquiry', 'We read through your details and any links you share.'],
                ['We talk it through', 'A short call about your products and goals.'],
                ['You get a proposal', 'Scope, timeline and cost for the right approach.'],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4">
                  <span className="font-display text-2xl text-champagne">0{i + 1}</span>
                  <span>
                    <span className="block text-[14.5px] font-semibold">{t}</span>
                    <span className="block text-[13.5px] text-muted">{b}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="panel p-6 shadow-lift sm:p-9">
            <AnimatePresence mode="wait">
              {outcome?.kind === 'sent' ? (
                <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-10 text-center" role="status">
                  <CheckCircle2 className="mx-auto h-11 w-11 text-success" strokeWidth={1.5} />
                  <h2 className="display mt-4 text-4xl">Thank you</h2>
                  <p className="mx-auto mt-3 max-w-sm text-[15px] text-cocoa">We’ve received your inquiry and will reply by email.</p>
                  <div className="mt-7 flex justify-center gap-3">
                    <button className="btn-ghost" onClick={() => setOutcome(null)}>Send another</button>
                    <Link to="/" className="btn-primary">Back to experiences <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                </motion.div>
              ) : (
                <motion.form key="form" ref={formRef} onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-5 sm:grid-cols-2">
                  <h2 className="display text-3xl sm:col-span-2">Project inquiry</h2>
                  <Field label="Name" name="name" required error={errors.name}>
                    <input id="name" name="name" autoComplete="name" className="field" value={form.name} onChange={(e) => set('name', e.target.value)} onBlur={() => blur('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-err' : undefined} />
                  </Field>
                  <Field label="Email" name="email" required error={errors.email}>
                    <input id="email" name="email" type="email" autoComplete="email" inputMode="email" className="field" value={form.email} onChange={(e) => set('email', e.target.value)} onBlur={() => blur('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-err' : undefined} />
                  </Field>
                  <Field label="Company" name="company">
                    <input id="company" name="company" autoComplete="organization" className="field" value={form.company} onChange={(e) => set('company', e.target.value)} />
                  </Field>
                  <Field label="Phone" name="phone" error={errors.phone}>
                    <input id="phone" name="phone" type="tel" autoComplete="tel" className="field" value={form.phone} onChange={(e) => set('phone', e.target.value)} onBlur={() => blur('phone')} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-err' : undefined} />
                  </Field>
                  <Field label="Project type" name="projectType" required error={errors.projectType}>
                    <select id="projectType" name="projectType" className="field" value={form.projectType} onChange={(e) => set('projectType', e.target.value)} onBlur={() => blur('projectType')} aria-invalid={!!errors.projectType} aria-describedby={errors.projectType ? 'projectType-err' : undefined}>
                      <option value="">Select a project type</option>
                      {PROJECT_TYPES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Budget range" name="budget" required error={errors.budget}>
                    <select id="budget" name="budget" className="field" value={form.budget} onChange={(e) => set('budget', e.target.value)} onBlur={() => blur('budget')} aria-invalid={!!errors.budget} aria-describedby={errors.budget ? 'budget-err' : undefined}>
                      <option value="">Select a range</option>
                      {BUDGETS.map((b) => <option key={b}>{b}</option>)}
                    </select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Project description" name="description" required error={errors.description}>
                      <textarea id="description" name="description" rows={5} className="field resize-y" placeholder="What do you sell, and what should shoppers be able to do?" value={form.description} onChange={(e) => set('description', e.target.value)} onBlur={() => blur('description')} aria-invalid={!!errors.description} aria-describedby={errors.description ? 'description-err' : undefined} />
                    </Field>
                  </div>
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="website">Website</label>
                    <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
                  </div>

                  {outcome?.kind === 'error' && (
                    <Notice tone="error" icon={<AlertCircle className="h-5 w-5" />} title="Your inquiry wasn’t sent">
                      {outcome.message} Your details are still here, so please try again.
                    </Notice>
                  )}
                  {outcome?.kind === 'mail' && (
                    <Notice tone="info" icon={<Mail className="h-5 w-5" />} title="Finish in your email app">
                      We opened a draft addressed to {SITE.contactEmail}. Your inquiry is sent once you press send there.
                    </Notice>
                  )}
                  {outcome?.kind === 'unconfigured' && (
                    <Notice tone="info" icon={<AlertCircle className="h-5 w-5" />} title="Online submission isn’t connected on this site">
                      Your inquiry has not been sent. Copy it and send it to your Cubiccode contact.
                      <button type="button" onClick={copy} className="btn-link mt-2 flex">
                        <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy inquiry'}
                      </button>
                    </Notice>
                  )}

                  <div className="sm:col-span-2">
                    <button type="submit" disabled={busy} className="btn-primary w-full py-3.5">
                      {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <>Send inquiry <ArrowRight className="h-4 w-4" /></>}
                    </button>
                    <p className="mt-3 text-center text-[12px] text-muted">We only use these details to respond to your inquiry.</p>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </>
  );
}

function Field({ label, name, required, error, children }: { label: string; name: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
        {required ? <span className="text-gold-deep"> *</span> : <span className="font-medium tracking-normal text-muted/70 normal-case"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${name}-err`} className="mt-1.5 text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Notice({ tone, icon, title, children }: { tone: 'error' | 'info'; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={`flex gap-3 rounded-md border p-4 text-[13.5px] sm:col-span-2 ${tone === 'error' ? 'border-danger/30 bg-[#fbefed] text-danger' : 'border-champagne/50 bg-cream text-cocoa'}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <div className="mt-1 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
