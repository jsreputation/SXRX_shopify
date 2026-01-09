/**
 *  @class
 *  @function CartNotes
 */
if (!customElements.get('cart-notes')) {
  class CartNotes extends HTMLElement {
    constructor() {
      super();
    }
    connectedCallback() {
      this.toggle = this.querySelector('#order-note-toggle');
      this.notes = this.querySelector('#mini-cart__notes');

      this.toggle.addEventListener('click', (event) => {
        this.toggle.nextElementSibling.classList.add('active');
      });
      this.toggle.nextElementSibling.querySelectorAll('.button, .order-note-toggle__content-overlay').forEach((el) => {
        el.addEventListener('click', (event) => {
          this.toggle.nextElementSibling.classList.remove('active');
          this.saveNotes();
        });
      });
    }
    saveNotes() {
      fetch(`${theme.routes.cart_update_url}.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': `application/json`
        },
        body: JSON.stringify({
          'note': this.notes.value
        })
      });
    }
  }
  customElements.define('cart-notes', CartNotes);
}