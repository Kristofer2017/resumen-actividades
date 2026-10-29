import { useReport } from '../../context/reportContext.js'
import Field from '../ui/Field.jsx'
import Panel from '../ui/Panel.jsx'
import TextField from '../ui/TextField.jsx'

export default function ProfilePanel() {
  const { profile, updateProfile } = useReport()

  return (
    <Panel className="compact">
      <div className="grid-2">
        <Field label="Nombre">
          <TextField
            id="nombre"
            value={profile.nombre}
            onChange={(value) => updateProfile('nombre', value)}
            autoComplete="name"
          />
        </Field>
        <Field label="Cargo">
          <TextField
            id="cargo"
            value={profile.cargo}
            onChange={(value) => updateProfile('cargo', value)}
          />
        </Field>
      </div>

      <Field label="Unidad" tight>
        <TextField
          id="unidad"
          value={profile.unidad}
          onChange={(value) => updateProfile('unidad', value)}
        />
      </Field>
    </Panel>
  )
}
