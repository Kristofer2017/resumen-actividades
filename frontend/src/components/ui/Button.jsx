export default function Button({
  variant = 'ghost',
  className = '',
  children,
  ...props
}) {
  const classes = `btn ${variant} ${className}`.trim()
  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  )
}
