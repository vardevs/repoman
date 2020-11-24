module.exports = function ({ gh, owner }) {
    return async function sync_automated_security_fixes(repo) {
        console.log(`[RUN] syncing automated security fixes for ${repo.name}`)

        let automated_security_fixes_synced = true

        try {
            const resp = await gh.request('GET /repos/{owner}/{repo}/automated-security-fixes', {
                owner,
                repo: repo.name,
                mediaType: {
                    previews: [
                        'london',
                    ],
                },
            })

            if (resp.status >= 200 && resp.status < 300) {
                console.info(`[OK] automated security fixes for ${owner}/${repo.name} already enabled`)
            } else {
                console.warn(`[WARN] automated security fixes for ${owner}/${repo.name} disabled, attempting to enable`)
                const alerts_resp = await gh.request('PUT /repos/{owner}/${repo}/automated-security-fixes', {
                    owner,
                    repo: repo.name,
                    mediaType: {
                        previews: [
                            'dorian',
                        ],
                    },
                })

                if (resp.status >= 200 && resp.status < 300) {
                    console.info(`[OK] automated security fixes for ${owner}/${repo.name} enabled`)
                } else {
                    console.error(`[FAIL] could not enable automated security fixes for ${owner}/${repo.name}`)
                    automated_security_fixes_synced = false
                }
            }
        } catch (error) {
            console.error(`[ERROR] could not enable automated security fixes for ${owner}/${repo.name}`, error.status)
            automated_security_fixes_synced = false
        }

        return {
            ...repo,
            automated_security_fixes_synced,
        }
    }
}
