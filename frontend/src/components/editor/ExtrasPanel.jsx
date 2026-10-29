import { useReport } from '../../context/reportContext.js'
import Field from '../ui/Field.jsx'
import TextAreaField from '../ui/TextAreaField.jsx'

export default function ExtrasPanel() {
  const { meta, updateMeta } = useReport()

  return (
    <details className="panel extras">
      <summary>Otras secciones del informe</summary>

      <Field label="1) Cumplimiento e instrucciones">
        <TextAreaField
          id="cumplimiento"
          rows={3}
          value={meta.cumplimiento}
          onChange={(value) => updateMeta('cumplimiento', value)}
          placeholder="Ej. Entrega de módulo de reportes"
          autoComplete="off"
        />
      </Field>

      <Field label="3) Proyecciones siguiente semana">
        <TextAreaField
          id="proyecciones"
          rows={3}
          value={meta.proyecciones}
          onChange={(value) => updateMeta('proyecciones', value)}
          placeholder="Ej. Continuar calibración de equipos"
          autoComplete="off"
        />
      </Field>

      <Field label="4) Observaciones">
        <TextAreaField
          id="observaciones"
          rows={3}
          value={meta.observaciones}
          onChange={(value) => updateMeta('observaciones', value)}
          placeholder="Notas relevantes de la semana"
          autoComplete="off"
        />
      </Field>
    </details>
  )
}
