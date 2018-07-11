const sectionEls = document.getElementsByTagName('section')
for (const sectionEl of sectionEls) {
    const triggers = sectionEl.querySelectorAll('[data-trigger]')

    for (const triggerEl of triggers) {
        const triggerName = triggerEl.dataset.trigger
        const areaEl = sectionEl.querySelector(`[data-area="${triggerName}"]`)

        if (areaEl == null) console.warn(`Missing data-area for "${triggerName}".`)

        triggerEl.addEventListener('mouseenter', () => areaEl.classList.add('active'))
        triggerEl.addEventListener('mouseleave', () => areaEl.classList.remove('active'))

        areaEl.addEventListener('mouseenter', () => {
            triggerEl.classList.add('active')
            areaEl.classList.add('active')
        })
        areaEl.addEventListener('mouseleave', () => {
            triggerEl.classList.remove('active')
            areaEl.classList.remove('active')
        })
    }
}

const fakeAnchors = document.querySelectorAll('a[href="#"]')
for (const fakeAnchor of fakeAnchors) {
    fakeAnchor.addEventListener('click', event => {
        event.preventDefault()
        window.alert(`We still haven't written that article, sorry.`)
    })
}

document.body.classList.add('js')
