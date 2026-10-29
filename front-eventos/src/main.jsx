import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { App as AplicacionAntd, ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import SesionProvider from './contexto/SesionProvider.jsx'

dayjs.locale('es')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ConfigProvider locale={esES} theme={{ token: {
        colorPrimary: '#2563eb', colorInfo: '#2563eb', colorText: '#262626',
        colorBgLayout: '#f5f5f5', borderRadius: 6,
        fontFamily: '"Segoe UI", system-ui, sans-serif', controlHeight: 36,
        motionDurationFast: '0.1s', motionDurationMid: '0.15s', motionDurationSlow: '0.2s'
      }, components: { Menu: {
        itemHeight: 40
      }, Tabs: {
        // Pestañas que se distinguen: la activa en azul y negrita sobre blanco,
        // las demás en gris sobre un fondo apagado
        titleFontSize: 15, itemColor: "#595959", itemSelectedColor: "#2563eb", itemHoverColor: "#1d4ed8",
        inkBarColor: "#2563eb", cardBg: "#ececec", cardGutter: 4, horizontalItemPaddingLG: "12px 20px"
      } } }}>
        <AplicacionAntd>
          <SesionProvider><App /></SesionProvider>
        </AplicacionAntd>
      </ConfigProvider>
    </BrowserRouter>
  </StrictMode>,
)
