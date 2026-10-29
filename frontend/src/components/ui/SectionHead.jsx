import Chip from './Chip.jsx'

export default function SectionHead({ title, chip }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {chip ? <Chip>{chip}</Chip> : null}
    </div>
  )
}
