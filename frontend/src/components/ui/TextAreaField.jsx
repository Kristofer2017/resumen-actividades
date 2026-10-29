export default function TextAreaField({
  value,
  onChange,
  className = '',
  ...props
}) {
  return (
    <textarea
      {...props}
      className={className}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
