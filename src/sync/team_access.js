module.exports = function ({ owner, gh }) {
    return async function sync_team_access(repo) {
        console.info(`[RUN] sync team access for ${owner}/${repo.name}`)

        let team_access_synced = true

        try {
            for (const team of repo.teams) {
                const resp = await gh.request('PUT /orgs/{owner}/teams/{team_slug}/repos/{owner}/{repo}', {
                    owner,
                    org: owner,
                    team_slug: team.name,
                    permission: team.permission,
                    repo: repo.name,
                })

                if (resp.status >= 200 && resp.status < 300) {
                    console.info(`[OK] ${team.name} added to ${owner}/${repo.name} with permission: ${team.permission}`)
                } else {
                    console.warn(`[WARN] could not add ${team.name} to ${owner}/${repo.name} with permission: ${team.permission}`)
                    team_access_synced = false
                }
            }
        } catch (error) {
            console.error(error)
        }

        return {
            ...repo,
            team_access_synced,
        }
    }
}
