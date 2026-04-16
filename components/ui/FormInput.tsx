import { clsx } from 'clsx'
import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

// ── Shared input styles ────────────────────────────────────────────────
const baseClasses =
  'w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 focus:ring-offset-slate-900 disabled:opacity-50'

// ── Text Input ─────────────────────────────────────────────────────────
type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
}

const FormInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs text-slate-400 mb-1">
          {label}
        </label>
      )}
      <input ref={ref} id={id} className={clsx(baseClasses, className)} {...props} />
    </div>
  )
)
FormInput.displayName = 'FormInput'

// ── Select ─────────────────────────────────────────────────────────────
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
}

const FormSelect = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, id, children, ...props }, ref) => (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs text-slate-400 mb-1">
          {label}
        </label>
      )}
      <select ref={ref} id={id} className={clsx(baseClasses, className)} {...props}>
        {children}
      </select>
    </div>
  )
)
FormSelect.displayName = 'FormSelect'

// ── Textarea ───────────────────────────────────────────────────────────
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
}

const FormTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, id, ...props }, ref) => (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs text-slate-400 mb-1">
          {label}
        </label>
      )}
      <textarea ref={ref} id={id} className={clsx(baseClasses, 'resize-none', className)} {...props} />
    </div>
  )
)
FormTextarea.displayName = 'FormTextarea'

export { FormInput, FormSelect, FormTextarea }
