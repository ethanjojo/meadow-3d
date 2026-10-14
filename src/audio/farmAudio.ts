import { FARM_CHANNELS } from '../core/audioSettings'

export const FARM_CALLS = FARM_CHANNELS.map(call => ({ ...call, fadeIn: .025, fadeOut: .08 }))
