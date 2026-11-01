| Language | Attack | Defence | Result | Observed |
|---|---|---|---|---|
| python | Control: normal program | (sandbox still works) | ✅ Contained | exit=0 444ms |
| python | Control: stdin | (sandbox still works) | ✅ Contained | exit=0 408ms |
| python | Infinite loop | Host-side timer + docker kill | ✅ Contained | exit=137 timeout 7217ms |
| python | Fork bomb | --pids-limit 64 | ✅ Contained | exit=1 748ms |
| python | Memory hog | --memory 128m, swap disabled | ✅ Contained | exit=137 oom 668ms |
| python | Internet access | --network none | ✅ Contained | exit=1 6099ms |
| python | Reach host Postgres/Redis | --network none | ✅ Contained | exit=0 5610ms |
| python | Write to root filesystem | --read-only | ✅ Contained | exit=1 974ms |
| python | Overwrite own source | Read-only bind mount | ✅ Contained | exit=1 456ms |
| python | Fill the disk | Small tmpfs (16 MB) | ✅ Contained | exit=1 488ms |
| python | Output flood | 64 KB output cap + kill | ✅ Contained | exit=137 truncated 523ms |
| python | Run as root? | --user 65534 | ✅ Contained | exit=0 454ms |
| python | Leak server secrets | Clean container environment | ✅ Contained | exit=0 457ms |
| python | Escalate privileges | --cap-drop ALL, no-new-privileges | ✅ Contained | exit=1 497ms |
| cpp | Control: Two Sum with stdin | (sandbox still works) | ✅ Contained | exit=0 1698ms |
| cpp | Compile error | Reported cleanly, no crash | ✅ Contained | exit=97 compile-error 525ms |
| cpp | Infinite loop | Run timer (5 s) | ✅ Contained | exit=137 timeout 5523ms |
| cpp | Fork bomb | --pids-limit 128 | ✅ Contained | exit=137 timeout 10642ms |
| cpp | Memory hog | --memory 512m, swap disabled | ✅ Contained | exit=137 oom 1112ms |
| cpp | Output flood | 64 KB output cap + kill | ✅ Contained | exit=137 truncated 637ms |
| cpp | Compile-time bomb (#include /dev/zero) | Compile timer + memory limit | ✅ Contained | exit=97 compile-error 843ms |
| cpp | Shell out and download | --network none | ✅ Contained | exit=0 timeout 5520ms |
| java | Control: hello | (sandbox still works) | ✅ Contained | exit=0 1485ms |
| java | Compile error | Reported cleanly, no crash | ✅ Contained | exit=97 compile-error 1079ms |
| java | Infinite loop | Run timer (7 s) | ✅ Contained | exit=137 timeout 8203ms |
| java | Memory hog | -Xmx256m + --memory 512m | ✅ Contained | exit=1 oom 1479ms |
| java | Thread bomb | --pids-limit 256 | ✅ Contained | exit=137 timeout 8311ms |
| java | Shell fork bomb via exec | --pids-limit 256 | ✅ Contained | exit=1 oom 1463ms |
| java | Internet access | --network none | ✅ Contained | exit=1 6205ms |
| java | Write to root filesystem | --read-only | ✅ Contained | exit=1 1413ms |
| java | Output flood | 64 KB output cap + kill | ✅ Contained | exit=137 truncated 1338ms |

Leftover containers after the run: none