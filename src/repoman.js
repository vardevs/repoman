const fs = require('fs')

const { Octokit } = require('@octokit/core')
const Promise = require('bluebird')

require('toml-require').install()
const { github_token, owner, secrets, teams } = require('../env.toml')

const gh = new Octokit({
    auth: github_token,
})

const sync_fns = fs.readdirSync('./src/sync', {
    encoding: 'utf8',
}).map(fn => require(`./sync/${fn}`)({ gh, owner, secrets }))

async function main() {
    let nextPage = 1
    let repos = []

    do {
        console.log(`[RUN] fetch page ${nextPage} of repos for ${owner}`)

        const resp = await gh.request('GET /orgs/{owner}/repos', {
            owner,
            per_page: 50,
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

    const opts = { concurrency: 10 }
    try {
        const managed_repos = await Promise
            .map(repos, custom, opts)
            .map(populate_topics, opts)
            .filter(managed)
            .map(sync_all, opts)

        console.log(managed_repos)
    } catch (error) {
        console.error(error)
    }
}

async function sync_all(repo) {
    return await Promise
        .map(sync_fns, fn => fn(repo))
        .reduce((a, b) => ({ ...a, ...b }))
}

function custom(repo) {
    return {
        name: repo.name,
        id: repo.id,
        teams,
    }
}

function managed(repo) {
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

    if (repo_topics.status >= 200 && repo_topics.status < 300) {
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

main()
