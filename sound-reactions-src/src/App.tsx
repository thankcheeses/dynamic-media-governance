import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Audit from './pages/Audit'
import Compare from './pages/Compare'
import Composer from './pages/Composer'
import Feed from './pages/Feed'
import Governance from './pages/Governance'
import Presentation from './pages/Presentation'
import Profile from './pages/Profile'
import SettingsPage from './pages/Settings'

export default function App() {
  return <Layout><Routes><Route path="/" element={<Feed />} /><Route path="/compose" element={<Composer />} /><Route path="/compare" element={<Compare />} /><Route path="/governance" element={<Governance />} /><Route path="/audit" element={<Audit />} /><Route path="/profile" element={<Profile />} /><Route path="/u/:handle" element={<Profile />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/presentation" element={<Presentation />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></Layout>
}
