import type { PipelineConfig } from '../types.js';

export interface WeatherReading {
  temp: number;
  conditions: string;
}

/** OpenWeather "time machine" lookup for the moment the photo was taken. */
export async function getWeatherAt(
  lat: number,
  lng: number,
  timestamp: number,
  config: PipelineConfig,
): Promise<WeatherReading> {
  if (!config.openWeatherKey) throw new Error('OPENWEATHER_KEY not configured');

  const dt = Math.floor(timestamp / 1000);
  const url =
    `https://api.openweathermap.org/data/3.0/onecall/timemachine` +
    `?lat=${lat}&lon=${lng}&dt=${dt}&appid=${config.openWeatherKey}&units=metric`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Weather API failed: HTTP ${res.status}`);

  const data = (await res.json()) as {
    data?: Array<{ temp: number; weather: Array<{ main: string }> }>;
  };
  const hour = data.data?.[0];
  if (!hour) throw new Error('Weather API returned no readings');

  return { temp: hour.temp, conditions: hour.weather[0]?.main ?? 'Unknown' };
}
