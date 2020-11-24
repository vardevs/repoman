module.exports = function ({ owner, gh }) { 
    return async function sync_collaborators(repo) {
        console.log(`[RUN] syncing collaborators for ${repo.name}`)

        let direct_collaborators_synced = true

        try {
            const resp = await gh.request('GET /repos/{owner}/{repo}/collaborators', {
                owner,
                repo: repo.name,
                affiliation: 'direct',
            })

            if (resp.status === 200) {
                console.info(`[OK] collaborators for ${owner}/${repo.name}`)
                const direct_collaborators = resp.data

                for (const person of direct_collaborators) {
                    console.log(person.login)
                    const remove_resp = gh.request('DELETE /repos/{owner}/{repo}/collaborators/{user}', {
                        owner,
                        repo: repo.name,
                        user: person.login,
                    })

                    if (remove_resp.status >= 200 && resp.status < 300) {
                        console.info(`[OK] removed ${person.login} from direct collaboration list`)
                    } else {
                        console.warn(`[WARN] failed to remove ${person.login} from direct collaboration list`, resp)
                        direct_collaborators_synced = false
                    }
                }
            } else {
                console.error(`[FAIL] could not list collaborators for ${owner}/${repo.name}`)
                direct_collaborators_synced = false
            }
        } catch (error) {
            console.error(error)
        }

        return {
            ...repo,
            direct_collaborators_synced,
        }
    }
}
