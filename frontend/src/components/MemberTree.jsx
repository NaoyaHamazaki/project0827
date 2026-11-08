import { useEffect, useState } from 'react'
import { fetchMemberTree } from '../api/members'
import './MemberTree.css'

const ROLE_LABELS = {
  master: 'マスター',
  admin: '管理者',
  representative: 'ユーザー（代表）',
  user: 'ユーザー',
}

function TreeNode({ node }) {
  return (
    <li>
      <div className={`member-tree__node is-${node.role} ${node.status !== 'active' ? 'is-inactive' : ''}`}>
        <span className="member-tree__role">{ROLE_LABELS[node.role]}</span>
        <span className="member-tree__name">{node.name}</span>
        {(node.code || node.subtitle) && (
          <span className="member-tree__meta" title={[node.code, node.subtitle].filter(Boolean).join(" · ")}>
            {node.code}{node.code && node.subtitle ? ' · ' : ''}{node.subtitle}
          </span>
        )}
        {node.status !== 'active' && <span className="member-tree__off">無効</span>}
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child, index) => <TreeNode key={`${child.code}-${index}`} node={child} />)}
        </ul>
      )}
    </li>
  )
}

// ログイン中のアカウントの配下を組織図の形で表示する（マスター→管理者→代表→ユーザー）
export default function MemberTree() {
  const [tree, setTree] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMemberTree().then(setTree).catch(() => setError('ツリーを読み込めませんでした'))
  }, [])

  if (error) return <p className="member-tree__status">{error}</p>
  if (!tree) return <p className="member-tree__status">読み込み中…</p>

  return (
    <div className="member-tree">
      <ul className="member-tree__root">
        <TreeNode node={tree} />
      </ul>
    </div>
  )
}
