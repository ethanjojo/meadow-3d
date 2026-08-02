import { Canvas } from '@react-three/fiber'
import './styles.css'

export function App() {
  return (
    <main className="experience" aria-label="Živá louka">
      <Canvas
        data-testid="nature-canvas"
        camera={{ position: [0, 1.1, 5], fov: 48 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#9fcce5']} />
      </Canvas>
    </main>
  )
}
