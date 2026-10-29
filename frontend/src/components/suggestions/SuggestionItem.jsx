export default function SuggestionItem({
  item,
  copied,
  onToggle,
  onTextChange,
  onCopy,
}) {
  return (
    <div className={`suggestion-item${item.selected ? ' is-selected' : ''}`}>
      <input
        type="checkbox"
        checked={item.selected}
        onChange={() => onToggle(item.hash)}
        aria-label={`Seleccionar ${item.subject}`}
      />

      <div className="suggestion-item-main">
        <textarea
          rows={2}
          value={item.text}
          onChange={(event) => onTextChange(item.hash, event.target.value)}
          aria-label={`Actividad sugerida para ${item.subject}`}
        />

        <div className="suggestion-commit">
          <span className={`suggestion-type type-${item.category}`}>
            {item.category}
          </span>
          <code>{item.shortHash}</code>
          <span>{item.time}</span>
          {item.duplicates > 1 ? (
            <span className="suggestion-duplicates">×{item.duplicates}</span>
          ) : null}
          {item.confidence === 'low' ? (
            <span className="suggestion-review">Revisar</span>
          ) : null}

          <button
            type="button"
            className="link-button"
            onClick={() => onCopy(item)}
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>

          <span className="suggestion-original">{item.subject}</span>
        </div>
      </div>
    </div>
  )
}
