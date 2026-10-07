import { motion } from 'framer-motion'
import appLogo from '../assets/app-logo.svg'

/**
 * Brief animated cover shown while the app's stores and backend event
 * listeners (sharing/discovery, visual settings) initialize on launch —
 * see App.tsx, which mounts this for a minimum duration so it never
 * flashes, then fades it out once init is done.
 */
export function LoadingScreen() {
  return (
    <motion.div
      className="loading-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
    >
      <div className="loading-screen-mark">
        <span className="loading-screen-glow" aria-hidden="true" />
        <span className="loading-screen-ring" aria-hidden="true" />
        <motion.span
          className="loading-screen-badge"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <img src={appLogo} alt="" />
        </motion.span>
      </div>
      <motion.div
        className="loading-screen-text"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
      >
        <span className="loading-screen-name">
          Tanjiro <span>Flow</span>
        </span>
        <span className="loading-screen-tagline">Developed by ANARKALI</span>
      </motion.div>
    </motion.div>
  )
}
