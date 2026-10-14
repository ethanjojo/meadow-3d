import { describe, expect, it } from 'vitest'
import { advanceNatureClock, createNatureClockState, sampleNatureClock } from '../../src/core/natureClock'
import { DEFAULT_SCENE_SETTINGS } from '../../src/core/sceneSettings'
import { getFarmWindowLight } from '../../src/core/farm'
import { advanceSnowCover, getStormEvent } from '../../src/core/sceneEffects'
import { createEnvironmentSnapshot, createEnvironmentTransition, stepEnvironmentTransition, DEFAULT_SIMULATION_SETTINGS } from '../../src/core/simulation'
import { createFlowerLayout } from '../../src/core/grassLayout'
import { getShootingStarState } from '../../src/core/celestial'

describe('advanced scene runtime', () => {
 it('preserves accumulated day and season positions across speed changes', () => {
  const clock = createNatureClockState()
  const before = advanceNatureClock(clock, 10, DEFAULT_SCENE_SETTINGS)
  const after = advanceNatureClock(clock, 0, {...DEFAULT_SCENE_SETTINGS, dayDuration: 600, seasonDuration: 2400})
  expect(after.dayCycle).toBe(before.dayCycle)
  expect(after.dayPhase).toBe(before.dayPhase)
  expect(after.seasonPhase).toBe(before.seasonPhase)
  const next = advanceNatureClock(clock, 6, {...DEFAULT_SCENE_SETTINGS, dayDuration: 600})
  expect(next.dayPhase - after.dayPhase).toBeCloseTo(.01)
 })
 it('pauses accumulated time and lets device time resume from its clock', () => {
  const clock = createNatureClockState()
  const before = advanceNatureClock(clock, 0, DEFAULT_SCENE_SETTINGS)
  expect(advanceNatureClock(clock, 20, {...DEFAULT_SCENE_SETTINGS, timePaused:true})).toEqual(before)
  expect(advanceNatureClock(clock, 0, {...DEFAULT_SCENE_SETTINGS, realTime:true}, new Date(2026, 9, 13, 21, 30)).dayPhase).toBeCloseTo(21.5 / 24)
 })
 it('allows custom overnight windows with scene-minute fades', () => {
  const settings = {...DEFAULT_SCENE_SETTINGS, farmLightMode: 'custom' as const, farmLightStart: 22, farmLightEnd: 3, farmLightStagger: false, farmLightFade: 6}
  expect(getFarmWindowLight(23 / 24, 0, settings)).toBe(1)
  expect(getFarmWindowLight(1 / 24, 2, settings)).toBe(1)
  expect(getFarmWindowLight(12 / 24, 0, settings)).toBe(0)
  expect(getFarmWindowLight(22.05 / 24, 0, settings)).toBeCloseTo(.5)
  expect(getFarmWindowLight(2.95 / 24, 0, settings)).toBeCloseTo(.5)
 })
 it('keeps staggered one-minute windows within their selected interval', () => {
  const settings = {...DEFAULT_SCENE_SETTINGS, farmLightMode:'custom' as const, farmLightStart:18.5, farmLightEnd:18.5 + 1 / 60, farmLightStagger:true, farmLightFade:0}
  for(const variation of [false,true]) for(let day=0;day<4;day++) for(let window=0;window<3;window++) {
   const varied = {...settings, farmLightVariation:variation}
   expect(getFarmWindowLight(.5,window,varied,day)).toBe(0)
   expect(getFarmWindowLight(0,window,varied,day)).toBe(0)
  }
  for(let window=0;window<3;window++) expect(getFarmWindowLight((18.5 + .5 / 60) / 24,window,settings)).toBe(1)
  const overnight = {...settings, farmLightStart:23.99,farmLightEnd:.01}
  for(let window=0;window<3;window++) {
   expect(getFarmWindowLight(0,window,overnight)).toBe(1)
   expect(getFarmWindowLight(.5,window,overnight)).toBe(0)
  }
  const fullDay = {...settings,farmLightEnd:18.5}
  for(let window=0;window<3;window++) expect(getFarmWindowLight(.5,window,fullDay)).toBe(1)
 })
 it('supports permanent light, disabled light and zero-length fades', () => {
  expect(getFarmWindowLight(0, 0, {...DEFAULT_SCENE_SETTINGS, farmLightMode:'always', farmLightBrightness:.4})).toBe(.4)
  expect(getFarmWindowLight(.8, 0, {...DEFAULT_SCENE_SETTINGS, farmLightMode:'off'})).toBe(0)
  expect(getFarmWindowLight(.8, 0, {...DEFAULT_SCENE_SETTINGS, farmLightFade:0})).toBe(1)
 })
 it('controls snow accumulation and melting independently', () => {
  expect(advanceSnowCover(0,1,1,undefined,{accumulation:1,melt:60})).toBeGreaterThan(advanceSnowCover(0,1,1))
  expect(advanceSnowCover(1,0,1,undefined,{accumulation:60,melt:1})).toBeLessThan(advanceSnowCover(1,0,1))
 })
 it('uses one configurable lightning and thunder event', () => {
  const event = getStormEvent(45, {interval:20,distanceKm:2})
  expect(event.id).toBe(2)
  expect(event.start).toBeGreaterThan(40)
  expect(event.start).toBeLessThan(60)
  expect(event.distanceKm).toBe(2)
  expect(event.thunderAt - event.start).toBeGreaterThan(0)
 })
 it('finishes configurable transitions while automatic clock remains paused', () => {
  const auto = sampleNatureClock(50)
  const frame = createEnvironmentTransition(auto, DEFAULT_SIMULATION_SETTINGS)
  const manual = {...DEFAULT_SIMULATION_SETTINGS, mode:'manual' as const, dayPhase:0}
  stepEnvironmentTransition(frame,auto,manual,0,{duration:1})
  stepEnvironmentTransition(frame,auto,manual,.5,{duration:1})
  expect(frame.active).toBe(true)
  stepEnvironmentTransition(frame,auto,manual,.5,{duration:1})
  expect(frame.active).toBe(false)
  expect(frame.snapshot.dayPhase).toBe(0)
 })
 it('crossfades switching to device time instead of jumping the sky', () => {
  const auto = sampleNatureClock(90)
  const frame = createEnvironmentTransition(auto, DEFAULT_SIMULATION_SETTINGS)
  const device = {...auto, dayPhase: 0}
  stepEnvironmentTransition(frame,device,DEFAULT_SIMULATION_SETTINGS,0,{realTime:true})
  expect(frame.snapshot.dayPhase).toBe(.5)
  expect(frame.active).toBe(true)
  for(let i=0;i<3;i++) stepEnvironmentTransition(frame,device,DEFAULT_SIMULATION_SETTINGS,.5,{realTime:true})
  expect(frame.progress).toBeCloseTo(.5)
  expect(frame.snapshot.dayPhase).toBeCloseTo(.25)
  for(let i=0;i<3;i++) stepEnvironmentTransition(frame,device,DEFAULT_SIMULATION_SETTINGS,.5,{realTime:true})
  expect(frame.snapshot.dayPhase).toBe(0)
  expect(frame.active).toBe(false)
 })
 it('limits automatic weather without restricting manual weather', () => {
  for(let seconds=0; seconds<900; seconds+=3) {
   const auto=sampleNatureClock(seconds)
   const snapshot=createEnvironmentSnapshot(auto,DEFAULT_SIMULATION_SETTINGS,undefined,['clear','fog'])
   expect(snapshot.weather.rain).toBe(0)
   expect(snapshot.weather.snow).toBe(0)
   expect(snapshot.weather.storm).toBe(0)
  }
  expect(createEnvironmentSnapshot(sampleNatureClock(0),{...DEFAULT_SIMULATION_SETTINGS,mode:'manual',weather:'storm'},undefined,['clear']).weather.storm).toBeGreaterThan(0)
 })
 it('generates pure species mixes deterministically', () => {
  const cornflowers = createFlowerLayout(100,2,{daisy:0,buttercup:0,cornflower:1})
  expect(Array.from(cornflowers.colorVariation).every(value=>value>1)).toBe(true)
  const daisies = createFlowerLayout(100,2,{daisy:1,buttercup:0,cornflower:0})
  expect(Array.from(daisies.colorVariation).every(value=>value<.68)).toBe(true)
  expect(cornflowers.offsets).toEqual(daisies.offsets)
 })
 it('shorter meteor interval increases occurrence opportunities', () => {
  const count = (interval:number) => {
   let active=0
   for(let t=0;t<600;t+=.1) for(let slot=0;slot<3;slot++) if(getShootingStarState(t,731,slot,1,interval).active) active++
   return active
  }
  expect(count(20)).toBeGreaterThan(count(95)*3)
 })
})
