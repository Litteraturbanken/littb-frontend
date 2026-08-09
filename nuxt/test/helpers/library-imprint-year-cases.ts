export const libraryImprintYearCases = [
  {
    mode: "all",
    path: "/bibliotek?filter=all-pagination&sort=titlar&sida=2&avancerat=1&k%C3%B6n=female&intervall=1800%2C2000&keep=one&keep=two",
    sort: "titlar",
    year: "1902"
  },
  {
    mode: "latest",
    path: "/bibliotek?visa=latest&sort=nytillkommet&sida=2&hide1800&avancerat=1&k%C3%B6n=female&intervall=1800%2C2000&keep=one&keep=two",
    sort: "nytillkommet",
    year: "1905"
  },
  {
    mode: "works",
    path: "/bibliotek?visa=works&sort=popularitet&sida=2&avancerat=1&k%C3%B6n=female&intervall=1800%2C2000&keep=one&keep=two",
    sort: "popularitet",
    year: "1905"
  },
  {
    mode: "parts",
    path: "/bibliotek?visa=parts&sort=titlar&sida=2&avancerat=1&k%C3%B6n=female&intervall=1800%2C2000&keep=one&keep=two",
    sort: "titlar",
    year: "1903"
  },
  {
    mode: "epub",
    path: "/bibliotek?visa=epub&sort=popularitet&sida=2&avancerat=1&k%C3%B6n=female&intervall=1800%2C2000&keep=one&keep=two",
    sort: "popularitet",
    year: "1891"
  },
  {
    mode: "pdf",
    path: "/bibliotek?visa=pdf&sort=popularitet&sida=2&avancerat=1&k%C3%B6n=female&intervall=1800%2C2000&keep=one&keep=two",
    sort: "popularitet",
    year: "1905"
  }
] as const
