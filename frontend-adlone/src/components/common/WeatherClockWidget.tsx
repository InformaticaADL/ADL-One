import { useState, useEffect } from 'react';

export const WeatherClockWidget = () => {
    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState<{ temp: number | null, maxTemp: number | null, minTemp: number | null, desc: string, icon: string }>({ temp: null, maxTemp: null, minTemp: null, desc: 'Cargando...', icon: '☁️' });

    // Update Clock Every Second
    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Weather
    useEffect(() => {
        const fetchWeather = async (lat: number, lon: number) => {
            try {
                // Fetch from Open-Meteo with daily min/max
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
                const data = await response.json();

                if (data && data.current_weather) {
                    const temp = Math.round(data.current_weather.temperature);
                    const code = data.current_weather.weathercode;
                    const maxTemp = data.daily?.temperature_2m_max?.[0] ? Math.round(data.daily.temperature_2m_max[0]) : null;
                    const minTemp = data.daily?.temperature_2m_min?.[0] ? Math.round(data.daily.temperature_2m_min[0]) : null;

                    // Simple weather code mapping for Widget UI
                    let desc = 'Clear';
                    let icon = '☀️';

                    if (code >= 1 && code <= 3) { desc = 'Mostly cloudy'; icon = '⛅'; }
                    else if (code >= 45 && code <= 48) { desc = 'Fog'; icon = '🌫️'; }
                    else if (code >= 51 && code <= 67) { desc = 'Rain'; icon = '🌧️'; }
                    else if (code >= 71 && code <= 77) { desc = 'Snow'; icon = '❄️'; }
                    else if (code >= 80 && code <= 82) { desc = 'Showers'; icon = '🌦️'; }
                    else if (code >= 95) { desc = 'Storm'; icon = '⛈️'; }

                    setWeather({ temp, maxTemp, minTemp, desc, icon });
                }
            } catch (error) {
                console.error("Error fetching weather:", error);
                setWeather({ temp: null, maxTemp: null, minTemp: null, desc: 'UNAVAILABLE', icon: '❓' });
            }
        };

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    fetchWeather(lat, lon);
                },
                (error) => {
                    console.warn("Geolocation denied or error, falling back to Santiago, Chile", error);
                    // Fallback to Santiago, Chile
                    fetchWeather(-33.448, -70.669);
                },
                { timeout: 5000 }
            );
        } else {
            // Fallback for browsers without geolocation
            fetchWeather(-33.448, -70.669);
        }
    }, []);

    // Formatting Helpers
    const formatTime24h = (date: Date) => {
        let hours = date.getHours().toString().padStart(2, '0');
        let minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const timeStr = formatTime24h(time);

    return (
        <div style={{
            background: 'white',
            color: '#1a1a1a',
            borderRadius: '16px',
            padding: '1rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: 'fit-content',
            gap: '2rem',
            boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            {/* Left Column: Clock */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
                <div style={{
                    fontSize: '2.5rem',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    letterSpacing: '-1px',
                    color: '#202124'
                }}>
                    {timeStr}
                </div>
            </div>

            {/* Right Column: Weather */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold', lineHeight: '1', color: '#202124' }}>
                        {weather.temp !== null ? `${weather.temp}°C` : '--°C'}
                    </span>
                </div>
            </div>
        </div>
    );
};
