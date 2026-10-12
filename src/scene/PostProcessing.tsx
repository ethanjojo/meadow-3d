import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector2 } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { QualityProfile } from '../core/quality'
import { meadowGradeShader } from './postProcessingShaders'

interface PostProcessingProps {
  quality: QualityProfile
}

export function PostProcessing({ quality }: PostProcessingProps) {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<EffectComposer | null>(null)

  useEffect(() => {
    let composer: EffectComposer | null = null
    let bloomPass: UnrealBloomPass | null = null
    let gradePass: ShaderPass | null = null
    let outputPass: OutputPass | null = null

    try {
      composer = new EffectComposer(gl)
      const renderPass = new RenderPass(scene, camera)
      bloomPass = new UnrealBloomPass(
        new Vector2(size.width, size.height),
        quality.bloomStrength,
        0.32,
        1.05,
      )
      gradePass = new ShaderPass(meadowGradeShader)
      gradePass.uniforms.uVignette.value = quality.vignetteStrength
      composer.addPass(renderPass)
      composer.addPass(bloomPass)
      composer.addPass(gradePass)
      outputPass = new OutputPass()
      composer.addPass(outputPass)
      composerRef.current = composer
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Postprocessing unavailable; using direct rendering.', error)
      }
      bloomPass?.dispose()
      gradePass?.dispose()
      outputPass?.dispose()
      composer?.dispose()
      composerRef.current = null
    }

    return () => {
      composerRef.current = null
      bloomPass?.dispose()
      gradePass?.dispose()
      outputPass?.dispose()
      composer?.dispose()
    }
  }, [camera, gl, quality.bloomStrength, quality.vignetteStrength, scene])

  useEffect(() => {
    const composer = composerRef.current
    if (!composer) return
    composer.setPixelRatio(
      gl.getPixelRatio() * quality.bloomResolutionScale,
    )
    composer.setSize(size.width, size.height)
  }, [gl, quality.bloomResolutionScale, size.height, size.width])

  useFrame(() => {
    const composer = composerRef.current
    if (composer) composer.render()
    else gl.render(scene, camera)
  }, 1)

  return null
}
