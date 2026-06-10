import React, { createContext, useContext, useState, useEffect } from "react";

export type CurrencyType = "USD" | "KES" | "EUR" | "GBP";

interface CurrencyConfig {
  code: CurrencyType;
  symbol: string;
  rateToKES: number; // How many KES is 1 unit of this currency
}

export const CURRENCY_CONFIGS: Record<CurrencyType, CurrencyConfig> = {
  KES: { code: "KES", symbol: "KSh", rateToKES: 1 },
  USD: { code: "USD", symbol: "$", rateToKES: 130 },
  EUR: { code: "EUR", symbol: "€", rateToKES: 140 },
  GBP: { code: "GBP", symbol: "£", rateToKES: 165 },
};

interface CurrencyContextType {
  activeCurrency: CurrencyType;
  setCurrency: (currency: CurrencyType) => void;
  convertFromKES: (amountKES: number) => number;
  convertToKES: (amount: number, fromCurrency?: CurrencyType) => number;
  format: (amountKES: number, hideSymbol?: boolean) => string;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [activeCurrency, setActiveCurrency] = useState<CurrencyType>(() => {
    const saved = localStorage.getItem("helavest_currency");
    return (saved as CurrencyType) || "USD"; // Default to dollars as requested!
  });

  useEffect(() => {
    localStorage.setItem("helavest_currency", activeCurrency);
  }, [activeCurrency]);

  const config = CURRENCY_CONFIGS[activeCurrency];

  const convertFromKES = (amountKES: number): number => {
    if (activeCurrency === "KES") return amountKES;
    return amountKES / config.rateToKES;
  };

  const convertToKES = (amount: number, fromCurrency: CurrencyType = activeCurrency): number => {
    const fromConfig = CURRENCY_CONFIGS[fromCurrency];
    return amount * fromConfig.rateToKES;
  };

  const format = (amountKES: number, hideSymbol = false): string => {
    const converted = convertFromKES(amountKES);
    // Determine precision: if conversion is not integer, show 2 decimal places to be neat.
    const isInteger = Number.isInteger(converted) || activeCurrency === "KES";
    const formattedVal = converted.toLocaleString(undefined, {
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: 2,
    });
    if (hideSymbol) return formattedVal;
    return activeCurrency === "KES" ? `${config.symbol} ${formattedVal}` : `${config.symbol}${formattedVal}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        activeCurrency,
        setCurrency: setActiveCurrency,
        convertFromKES,
        convertToKES,
        format,
        symbol: config.symbol,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
