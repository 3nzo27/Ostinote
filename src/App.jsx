import { ThemeProvider } from './theme/ThemeContext.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import FlashcardApp from './FlashcardApp.jsx'

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <FlashcardApp />
      </ThemeProvider>
    </AuthProvider>
  )
}
