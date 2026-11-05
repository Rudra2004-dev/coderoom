| Check | Result | Detail |
|---|---|---|
| No token: GET /rooms | ✅ Pass | expected 401, got 401 |
| No token: GET /rooms/:slug | ✅ Pass | expected 401, got 401 |
| Garbage token | ✅ Pass | expected 401, got 401 |
| No token: GET /jobs/1 | ✅ Pass | expected 401, got 401 |
| Candidate cannot create rooms | ✅ Pass | expected 403, got 403 |
| Candidate cannot list questions | ✅ Pass | expected 403, got 403 |
| Candidate cannot list interviews | ✅ Pass | expected 403, got 403 |
| Candidate cannot read a report | ✅ Pass | expected 403, got 403 |
| Other interviewer: report | ✅ Pass | expected 404, got 404 |
| Other interviewer: room | ✅ Pass | expected 404, got 404 |
| Other interviewer: pick question | ✅ Pass | expected 403, got 403 |
| Other interviewer: end room | ✅ Pass | expected 403, got 403 |
| Other interviewer: scorecard | ✅ Pass | expected 403, got 403 |
| Outsider candidate: room | ✅ Pass | expected 404, got 404 |
| Outsider candidate: run | ✅ Pass | expected 403, got 403 |
| Outsider candidate: submit | ✅ Pass | expected 403, got 403 |
| Outsider candidate: question | ✅ Pass | expected 403, got 403 |
| Missing room looks the same as someone else's | ✅ Pass | expected 404, got 404 |
| Unknown language is rejected | ✅ Pass | expected 400, got 400 |
| Empty submit is rejected | ✅ Pass | expected 400, got 400 |
| Oversized body is rejected | ✅ Pass | expected 413, got 413 |
| Short password is rejected | ✅ Pass | expected 400, got 400 |
| Candidate's question response contains no hidden inputs | ✅ Pass | hidden tests: 3 |
| Room payload carries no final code field | ✅ Pass |  |
| X-Content-Type-Options is nosniff | ✅ Pass |  |
| X-Powered-By is removed | ✅ Pass |  |
| Unknown route returns JSON 404 | ✅ Pass |  |
| No token | ✅ Pass | expected 401, got 401 |
| Outsider interviewer | ✅ Pass | expected 403, got 403 |
| Outsider candidate | ✅ Pass | expected 403, got 403 |
| Member (candidate) is accepted | ✅ Pass | expected 101, got 101 |
| Candidate cannot end the room | ✅ Pass | expected 403, got 403 |
| Owner ends the room | ✅ Pass | expected 200, got 200 |
| Run after the end | ✅ Pass | expected 409, got 409 |
| Submit after the end | ✅ Pass | expected 409, got 409 |
| Pick question after the end | ✅ Pass | expected 409, got 409 |
| WebSocket refused after the end | ✅ Pass | expected 409, got 409 |
| Report keeps the saved final code | ✅ Pass |  |