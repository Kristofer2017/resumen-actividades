export default function TextField({ value, onChange, ...props }) {
  return (
    <input
      {...props}
      type="text"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
