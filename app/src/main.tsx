import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import App from './presentation/App'
import { store } from './presentation/store/store'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Provider store={store}><App /></Provider></React.StrictMode>,
)
