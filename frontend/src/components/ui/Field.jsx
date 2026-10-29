export default function Field({
  label,
  inline = false,
  tight = false,
  className = '',
  children,
}) {
  const classes = ['field', inline && 'inline', tight && 'tight', className]
    .filter(Boolean)
    .join(' ')

  return (
    <label className={classes}>
      <span>{label}</span>
      {children}
    </label>
  )
}
