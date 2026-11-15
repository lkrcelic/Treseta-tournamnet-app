# Tokovi i testovi

Svaki tok iz perspektive igrača, organizatora i admina, i test koji ga pokriva (ili "nema"). Sekcije su u
[`sekcije/`](sekcije/README.md), plan u [`../E2E_SUITE_PLAN.md`](../E2E_SUITE_PLAN.md). Voditelj upisuje retke iz
izvještaja sekcija; sesija koja doda tok ili test dopiše svoj redak u istom commitu.

| Tok | Uloga | Test |
| --- | --- | --- |
| Prijava kroz API i Početna | igrač | `tests/smoke/baza.spec.ts` › a player logged in through the API lands on Početna |
