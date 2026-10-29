import EditorPane from './editor/EditorPane.jsx'
import PreviewPane from './preview/PreviewPane.jsx'

export default function Workspace() {
  return (
    <div className="workspace">
      <EditorPane />
      <PreviewPane />
    </div>
  )
}
