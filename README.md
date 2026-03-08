# ViewList

Excel(.xlsx/.xls) 및 Microsoft Access(.mdb/.accdb) 파일을 열어 데이터를 테이블로 보고, 차트로 시각화하고, 가공된 결과를 다시 내보낼 수 있는 **Windows 전용 데스크탑 앱**입니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **파일 열기** | .xlsx / .xls / .mdb / .accdb 동시에 여러 파일 열기 |
| **데이터 테이블** | 정렬 · 검색 · 페이지네이션 · 컬럼별 통계(min/max/mean/stddev) |
| **차트 빌더** | 서로 다른 파일/시트의 컬럼을 하나의 차트에 합쳐서 표시 (라인/산점도/막대/영역) |
| **대시보드** | 저장된 차트를 그리드로 배치 |
| **내보내기** | 현재 데이터를 .xlsx 또는 기존 .mdb 파일로 재저장 |

---

## 기술 스택

- **앱 셸**: Electron 28
- **빌드**: electron-vite + Vite 5
- **UI**: React 18 + TypeScript + Tailwind CSS v3
- **상태 관리**: Zustand (인메모리 데이터)
- **DB**: better-sqlite3 (메타데이터 · 차트 설정 영구 저장)
- **Excel 파싱/내보내기**: exceljs
- **MDB 파싱/내보내기**: node-adodb (Windows ODBC)
- **차트**: Recharts

---

## 시스템 요구사항

- **OS**: Windows 10 / 11 (64비트)
- **Node.js**: v18 이상
- **MDB/ACCDB 파일 사용 시**: Microsoft Access ODBC 드라이버 필요
  - `.mdb` → `Microsoft.Jet.OLEDB.4.0` (Windows 기본 포함)
  - `.accdb` → `Microsoft.ACE.OLEDB.12.0` ([별도 설치](https://www.microsoft.com/en-us/download/details.aspx?id=54920))

---

## 개발 환경 실행

```powershell
# 1. 저장소 클론
git clone https://github.com/SlowlyTom/VIEW_FILE.git
cd VIEW_FILE

# 2. 패키지 설치 (better-sqlite3 네이티브 빌드 포함)
npm install

# 3. better-sqlite3를 Electron Node 버전에 맞게 재컴파일
npm run rebuild

# 4. 개발 서버 실행 (Electron 창 + 핫 리로드)
npm run dev
```

> **rebuild가 필요한 경우**: `npm install` 후 앱 실행 시 `better-sqlite3` 관련 오류가 나오면 `npm run rebuild`를 실행하세요.

---

## 빌드 (EXE 배포판 생성)

```powershell
# 1. electron-builder 설치 (최초 1회)
npm install --save-dev electron-builder

# 2. 소스 빌드
npm run build

# 3. Windows 인스톨러 / 포터블 EXE 생성
npx electron-builder --win
```

생성된 파일은 `dist/` 폴더에 저장됩니다.

---

## 프로젝트 구조

```
ViewList/
├── src/
│   ├── main/                  # Electron 메인 프로세스 (Node.js)
│   │   ├── index.ts           # 앱 진입점, 윈도우 생성
│   │   ├── db.ts              # SQLite 초기화
│   │   └── ipc/
│   │       ├── fileHandlers.ts   # 파일 열기 · 파싱
│   │       ├── dbHandlers.ts     # 메타데이터 CRUD
│   │       ├── chartHandlers.ts  # 차트 설정 저장/로드
│   │       └── exportHandlers.ts # Excel · MDB 내보내기
│   ├── preload/
│   │   └── index.ts           # contextBridge IPC 브릿지
│   └── renderer/src/          # React 앱 (브라우저 렌더러)
│       ├── App.tsx            # 탭 레이아웃
│       ├── api.ts             # window.api 타입 정의
│       ├── components/        # FilePanel · DataTable · ChartBuilder · Dashboard · ExportPanel
│       ├── hooks/             # useDataset · useCharts · useExport
│       └── store/             # fileStore · dataStore (Zustand)
├── db/migrations/
│   └── 001_initial.sql        # SQLite 스키마
├── electron-vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## 데이터 흐름

```
파일 선택 (dialog)
  → 메인 프로세스에서 파싱 (exceljs / node-adodb)
  → 메타데이터 SQLite 저장 (파일 정보 · 컬럼 타입)
  → 전체 행 데이터 IPC로 렌더러 전달
  → Zustand dataStore에 인메모리 보관
  → 컴포넌트에서 직접 읽어 표시
```

앱을 재시작하면 SQLite에서 파일 목록·컬럼 정보는 복원되지만, **행 데이터는 원본 파일에서 재파싱**해야 합니다 (파일 패널에서 파일을 다시 선택).

---

## 멀티파일 차트 조인 방식

차트 빌더에서 서로 다른 파일/시트의 컬럼을 같은 차트에 올릴 때 두 가지 정렬 방식을 선택할 수 있습니다.

| 방식 | 설명 | 사용 시기 |
|------|------|-----------|
| **인덱스 조인** | 행 번호 순서대로 1:1 매칭. 행 수가 다르면 짧은 쪽 기준으로 자름 | 두 데이터셋의 행 순서가 동일할 때 |
| **키 조인** | 공통 컬럼(날짜, ID 등) 값을 기준으로 매칭 | 행 수가 다르거나 순서가 다를 때 |

---

## MDB 내보내기 제한 사항

- **기존 .mdb 파일에 새 테이블 추가** 방식으로만 동작합니다.
- 신규 .mdb 파일 생성은 지원하지 않습니다 (ADODB 제한).
- ACCDB 내보내기는 미지원 (Jet OLEDB 4.0만 사용).

---

## npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 모드 실행 (핫 리로드) |
| `npm run build` | 프로덕션 빌드 (`out/` 폴더) |
| `npm run rebuild` | better-sqlite3 네이티브 재컴파일 |
| `npm run preview` | 빌드 결과물로 앱 실행 |
