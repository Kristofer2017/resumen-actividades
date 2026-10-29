import { useReport } from '../../context/reportContext.js'
import Hint from '../ui/Hint.jsx'
import Panel from '../ui/Panel.jsx'
import SectionHead from '../ui/SectionHead.jsx'
import TextAreaField from '../ui/TextAreaField.jsx'

export default function GeneralView() {
  const { meta, updateMeta, resumenChip } = useReport()

  return (
    <Panel className="general-view">
      <SectionHead title="Resumen de la semana" chip={resumenChip} />

      <Hint>
        Describe la semana en general (una actividad por línea; deja una línea
        en blanco para separar párrafos). Si hay resumen general, el PDF lo usa
        en lugar del desglose por día.
      </Hint>

      <TextAreaField
        id="resumen"
        className="resumen-editor"
        value={meta.resumen}
        onChange={(value) => updateMeta('resumen', value)}
        placeholder="Escribe las actividades de la semana…"
        autoComplete="off"
      />
    </Panel>
  )
}
