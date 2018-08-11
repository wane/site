const sectionEls = document.getElementsByTagName('section')
sectionEls.forEach(sectionEl => {
  const triggers = sectionEl.querySelectorAll('[data-trigger]') as HTMLCollectionOf<HTMLElement>
  triggers.forEach(trigger => {
    const triggerName = trigger.dataset.trigger
    const areaEl = sectionEl.querySelector(`[data-area="${triggerName}"]`)!

    if (areaEl == null) console.warn(`Missing data-area for "${triggerName}".`)

    trigger.addEventListener('mouseenter', () => areaEl.classList.add('active'))
    trigger.addEventListener('mouseleave', () => areaEl.classList.remove('active'))

    areaEl.addEventListener('mouseenter', () => {
      trigger.classList.add('active')
      areaEl.classList.add('active')
    })
    areaEl.addEventListener('mouseleave', () => {
      trigger.classList.remove('active')
      areaEl.classList.remove('active')
    })
  })
})

const fakeAnchors = document.querySelectorAll('a[href="#"]')
fakeAnchors.forEach(fakeAnchor => {
  fakeAnchor.addEventListener('click', event => {
    event.preventDefault()
    window.alert(`We still haven't written that article, sorry.`)
  })
})

document.body.classList.add('js')
