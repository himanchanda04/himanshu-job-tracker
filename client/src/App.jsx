import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell      from './components/layout/AppShell';
import Dashboard     from './pages/Dashboard';
import Applications  from './pages/Applications';
import Discarded     from './pages/Discarded';
import Settings      from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index                    element={<Dashboard />}    />
          <Route path="applications"      element={<Applications />} />
          <Route path="discarded"         element={<Discarded />}    />
          <Route path="settings"          element={<Settings />}     />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
