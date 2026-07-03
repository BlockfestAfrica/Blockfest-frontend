/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { useState, useEffect, useRef } from 'react';
import { Bebas_Neue } from "next/font/google";
const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
});

interface CountdownProps {
  targetDate: string | Date;
  onExpire?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const TIME_UNITS: { key: keyof TimeLeft; label: string }[] = [
  { key: "days", label: "days" },
  { key: "hours", label: "hours" },
  { key: "minutes", label: "minutes" },
  { key: "seconds", label: "seconds" },
];

const VALUE_CLASSES = "text-[#3870D3] font-normal text-[34px] md:text-4xl lg:text-[104.95px] lg:leading-[110px]";

function TimeUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center flex-col">
      <p className={`${VALUE_CLASSES} tabular-nums`}>{value}</p>
      <p className="font-light text-[10px] md:text-lg lg:text-[31.98px] lg:leading-[120%] uppercase">
        {label}
      </p>
    </div>
  );
}

function Separator() {
  return <span className={VALUE_CLASSES}>:</span>;
}

export function Countdown ({ targetDate, onExpire }: CountdownProps)  {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateTimeLeft = (): TimeLeft => {
    const difference = +new Date(targetDate) - +new Date();

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  const formatNumber = (num: number): string => {
    return num.toString().padStart(2, '0');
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const updateCountdown = () => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      // Check if expired
      if (Object.values(newTimeLeft).every(value => value === 0)) {
        onExpire?.();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    };

    // Initial calculation
    updateCountdown();

    // Set up interval
    intervalRef.current = setInterval(updateCountdown, 1000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [targetDate, onExpire]);

  return (
    <div className={`${bebasNeue.className} flex items-start justify-between lg:justify-center border-[1.44px] lg:border-4 border-[#3870D3] space-x-2 lg:w-fit lg:space-x-5 rounded-lg lg:rounded-3xl py-2.5 px-5 md:px-10 lg:py-[30px] lg:px-[50px]`}>
      {TIME_UNITS.map((unit, index) => (
        <div key={unit.key} className="contents">
          {index > 0 && <Separator />}
          <TimeUnit
            value={formatNumber(timeLeft[unit.key])}
            label={unit.label}
          />
        </div>
      ))}
    </div>
  );
};
