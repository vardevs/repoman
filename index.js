const { Octokit } = require('@octokit/core')
const Promise = require('bluebird')

const pat = '66d08b2fa0ddcecb4d964a7c8ca14d71c126066d'
const owner = 'dhis2'

const gh = new Octokit({
    auth: pat,
})

async function main() {
    let nextPage = 1
    let repos = []

    do {
        console.log(`[RUN] fetch page ${nextPage} of repos for ${owner}`)

        const resp = await gh.request('GET /orgs/{owner}/repos', {
            owner,
            per_page: 100,
            page: nextPage,
        })

        const links = resp.headers.link
            .split(',')
            .filter(i => i.includes('rel="next"'))

        if (links.length > 0) {
            // get the first link, get contents of <>, get the first capture group
            const link = links[0].match(/<(.*?)>/)[1]

            const url = new URL(link)
            const params = url.searchParams
            nextPage = Number(params.get('page'))
        } else {
            nextPage = -1
        }

        if (resp.status === 200) {
            repos = repos.concat(resp.data)
        } else {
            console.error('big fat crash')
            process.exit(1)
        }
    } while (nextPage !== -1)

    const hydrated_repos = repos.map(custom)

    const opts = { concurrency: 10 }
    try {
        const managed_repos = await Promise
            .map(hydrated_repos, populate_topics, opts)
            .filter(managed)
            .map(sync_settings, opts)
            .map(sync_vulnerability_alerts, opts)
            .map(sync_automated_security_fixes, opts)
            .map(sync_collaborators, opts)
            .map(sync_team_access, opts)
    } catch (error) {
        console.error(error)
    }
}

function custom(repo) {
    return {
        name: repo.name,
        teams: [
            { name: 'front-end', permission: 'maintain' },
            { name: 'front-end-admins', permission: 'admin' },
            { name: 'bots', permission: 'admin' },
            { name: 'dhis2-devs-core', permission: 'push' },
        ],
    }
}

function managed (repo) {
    return repo.topics.includes('repoman-sync')
}

async function populate_topics(repo) {
    console.log(`[RUN] fetching topics for ${repo.name}`)
    const repo_topics = await gh.request('GET /repos/{owner}/{repo}/topics', {
        owner,
        repo: repo.name,
        mediaType: {
            previews: [
                'mercy'
            ]
        }
    })

    if (repo_topics.status === 200) {
        const topics = repo_topics.data.names

        return {
            ...repo,
            topics,
        }
    } else {
        return {
            ...repo,
        }
    }
}

async function sync_settings(repo) {
    console.log(`[RUN] syncing settings for ${repo.name}`)
    const resp = await gh.request('PATCH /repos/{owner}/{repo}', {
        owner,
        repo: repo.name,
        has_projects: false,
        has_issues: true,
        has_wiki: false,
        allow_squash_merge: true,
        allow_merge_commit: true,
        allow_rebase_merge: true,
        delete_branch_on_merge: true,
    })

    let settings_updated
    if (resp.status === 200) {
        console.info(`[OK] settings for ${owner}/${repo.name} updated successfully`)
        settings_updated = true
    } else {
        console.warn(`[WARN] settings for ${owner}/${repo.name} update failed`)
        settings_updated = false
    }

    return {
        ...repo,
        settings_updated,
    }
}

async function sync_vulnerability_alerts(repo) {
    console.log(`[RUN] syncing vulnerability alerts for ${repo.name}`)
    const resp = await gh.request('GET /repos/{owner}/{repo}/vulnerability-alerts', {
        owner,
        repo: repo.name,
        mediaType: {
            previews: [
                'dorian',
            ],
        },
    })

    let vulnerability_alerts_synced
    if (resp.status === 204) {
        console.info(`[OK] vulnerabilty alerts for ${owner}/${repo.name} already enabled`)
        vulnerability_alerts_synced = true
    } else {
        console.warn(`[WARN] vulnerability alerts for ${owner}/${repo.name} disabled, attempting to enable`)
        const alerts_resp = await gh.request('PUT /repos/{owner}/${repo}/vulnerability-alerts', {
            owner,
            repo: repo.name,
            mediaType: {
                previews: [
                    'dorian',
                ],
            },
        })

        if (resp.status === 204) {
            console.info(`[OK] vulnerabilty alerts for ${owner}/${repo.name} enabled`)
            vulnerability_alerts_synced = true
        } else {
            console.error(`[FAIL] could not enable vulnerability alerts for ${owner}/${repo.name}`)
            vulnerability_alerts_synced = false
        }

    }

    return {
        ...repo,
        vulnerability_alerts_synced,
    }
}

async function sync_automated_security_fixes(repo) {
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
        console.error(error)
        automated_security_fixes_synced = false
    }

    return {
        ...repo,
        automated_security_fixes_synced,
    }
}

async function sync_collaborators(repo) {
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

async function sync_team_access(repo) {
    console.info(`[RUN] sync team access for ${owner}/${repo.name}`)

    let team_access_synced = true
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

    return {
        ...repo,
        team_access_synced,
    }
}

main()
