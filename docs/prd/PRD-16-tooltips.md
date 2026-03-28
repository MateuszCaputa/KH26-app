# PRD-16: Tooltips na wszystkich metrykach

**Owner:** Mateusz
**Est:** 30 min
**Priority:** P1 — poprawia zrozumienie demo przez sędziów
**Status:** pending

---

## Why

Sędziowie i nowi użytkownicy widzą liczby (np. "deviation: 2.3", "avg duration: 412s") bez kontekstu — nie wiedzą co oznaczają ani czy to dużo czy mało. Tooltip wyjaśniający definicję i interpretację przy każdym hover zwiększa zrozumiałość demo i usuwa niezręczne pytania podczas prezentacji.

## Tasks

### 16A. Tooltips na metrykach wariantów (Variant Deviation)

**Plik:** `frontend/src/components/process-tabs.tsx`

Dodaj tooltip przy każdej z metryk wariantu:

| Pole | Tekst tooltipa |
|------|----------------|
| `deviation` | "Odchylenie od dominującej ścieżki procesu. Wartość 0 = brak odchyleń, im wyżej tym bardziej wariant różni się od normy." |
| `avg_duration` / `duration` | "Średni czas trwania wariantu od pierwszego do ostatniego kroku. Krótszy = bardziej efektywny." |
| `case_count` | "Liczba przypadków (sesji użytkownika), które przeszły tą ścieżką." |
| `percentage` | "Udział procentowy tego wariantu wśród wszystkich zarejestrowanych przypadków." |

### 16B. Tooltips na metrykach bottlenecków

**Plik:** `frontend/src/components/process-tabs.tsx`

| Pole | Tekst tooltipa |
|------|----------------|
| `severity` | "Ocena wagi wąskiego gardła (0–1). Powyżej 0.7 = krytyczne, wymaga natychmiastowej uwagi." |
| `avg_wait_seconds` | "Średni czas oczekiwania przed tym krokiem. Wysoka wartość oznacza kolejkę lub zależność zewnętrzną." |
| `frequency` | "Jak często ten krok pojawia się w logach. Im częściej, tym większy wpływ optymalizacji." |

### 16C. Tooltips na Health Score

**Plik:** `frontend/src/components/health-score.tsx`

| Element | Tekst tooltipa |
|---------|----------------|
| Główny wynik (liczba 0–100) | "Złożony wskaźnik zdrowia procesu: uwzględnia odchylenia wariantów, czas oczekiwania, częstotliwość context-switchów i powtarzalne kroki manualne." |
| Każdy sub-wskaźnik | Krótki opis co mierzy dana składowa. |

### 16D. Tooltips na ROI Calculator

**Plik:** `frontend/src/components/roi-calculator.tsx`

| Pole | Tekst tooltipa |
|------|----------------|
| `hours_saved` | "Szacowana liczba roboczogodzin zaoszczędzonych miesięcznie po wdrożeniu rekomendowanej automatyzacji." |
| `annual_savings` | "Roczna oszczędność finansowa przy założeniu średniego kosztu godziny pracy." |
| `payback_months` | "Szacowany czas zwrotu z inwestycji w automatyzację (koszt wdrożenia / miesięczna oszczędność)." |

### 16E. Tooltips na Automation Matrix

**Plik:** `frontend/src/components/automation-matrix.tsx`

| Kolumna | Tekst tooltipa |
|---------|----------------|
| `effort` | "Szacowany nakład pracy potrzebny do wdrożenia automatyzacji: Low / Medium / High." |
| `impact` | "Przewidywany wpływ na efektywność procesu po wdrożeniu." |
| `roi_score` | "Wskaźnik opłacalności: stosunek oczekiwanego zysku do nakładu pracy. Im wyższy, tym lepszy kandydat do automatyzacji." |

## Implementacja

Użyj istniejącego komponentu `Tooltip` z shadcn/ui (`@/components/ui/tooltip`). Wzorzec:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="underline decoration-dotted cursor-help">
        {value}
      </span>
    </TooltipTrigger>
    <TooltipContent>
      <p className="max-w-xs text-sm">Opis metryki...</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

Dla nagłówków kolumn użyj ikony info zamiast podkreślenia:

```tsx
<span className="flex items-center gap-1">
  Deviation
  <InfoIcon className="h-3 w-3 text-muted-foreground" />
</span>
```

## Verification

- Hover nad każdą metryką → tooltip pojawia się po ~300ms
- Tooltip nie wychodzi poza ekran (shadcn obsługuje to automatycznie)
- `npm run build` — brak błędów TypeScript
- Wizualnie: podkreślenie kropkowane lub ikona info sygnalizuje interaktywność
