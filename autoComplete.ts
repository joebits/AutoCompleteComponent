import { autoinject } from 'aurelia-dependency-injection';
import { customElement, bindable } from 'aurelia-framework';
import { AutoCompleteItem } from './autoCompleteItem';
import { EventAggregator } from 'aurelia-event-aggregator';
import { AutoCompleteEvent } from './autoCompleteEvent';

@customElement('auto-complete')
@autoinject
export class AutoComplete {

    eventAggregator: EventAggregator;
    searchTerm: string = 'Search..';
    previousSearchTerm: string = '';
    searchResult: Array<AutoCompleteItem>;
    open: boolean = false;
    searches: { [key: string]: Array<AutoCompleteItem> } = {};
    idClass: string;
    currentSearchItemCounter: number = null;
    hasFocus: boolean = false;


    @bindable searchables: Array<AutoCompleteItem>;
    @bindable itemType: string;
    @bindable selectedItemId: number;
    @bindable showAll: boolean = false;

    handleBodyClick: EventListener;
    handleKeypress: EventListener;

    mutationObserver: MutationObserver;
    observerConfig = {
        attributes: false,
        childList: true,
        characterData: false
    };

    constructor(eventAggregator: EventAggregator) {
        this.eventAggregator = eventAggregator;
        this.idClass = '' + Date.now() + Math.random();

    }

    attached() {
        this.mutationObserver = new MutationObserver(mutations => this.observeAction(mutations));
        this.mutationObserver.observe(document.getElementById('search-wrapper-' + this.idClass), this.observerConfig);
        this.searchResult = this.searchables;
        this.updateSearchTerm();
    }

    observeAction(mutations: MutationRecord[]) {
        mutations.forEach(mutations => {
            if (mutations.addedNodes.length) {
                this.highlightSelectedItem();
            }
        });
    }

    private updateSearchTerm() {
        if (!!this.searchables && this.searchables.length > 0) {
            let selectedItem: AutoCompleteItem = this.searchables.find(item => item.id === this.selectedItemId);
            this.searchTerm = selectedItem != null ? selectedItem.description : '';
        } else {
            this.searchTerm = '';
        }
    };

    detached() {
        this.mutationObserver.disconnect();
        this.searchables = [];
        this.searchResult = [];
        this.searchTerm = '';
    }

    highlightSelectedItem() {
        if (this.selectedItemId) {
            this.removeCssClassFromCurrentSearchItem(this.currentSearchItemCounter);
            for (let i = 0, length = this.searchResult.length; i < length; i++) {
                let item = this.searchResult[i];
                if (item.id === this.selectedItemId) {
                    this.currentSearchItemCounter = i;
                    this.addCssClassToCurrentSearchItem(this.currentSearchItemCounter);
                    this.scrollInList(1);
                    break;
                }
            }
        }

    }


    handleKeypressInput(event: KeyboardEvent) {

        if (event.keyCode == 13 || event.keyCode == 9) {
            if (this.isOpenAndHasSearchResults() && this.currentSearchItemCounter != null) {
                this.selectSearchItem(this.searchResult[this.currentSearchItemCounter]);
            }
        } else if (event.keyCode == 40) {
            if (this.isOpenAndHasSearchResults()) {
                if (this.currentSearchItemCounter != null) {
                    this.removeCssClassFromCurrentSearchItem(this.currentSearchItemCounter);
                    this.currentSearchItemCounter = (this.currentSearchItemCounter + 1 + this.searchResult.length) % this.searchResult.length;
                } else {
                    this.currentSearchItemCounter = 0;
                }
                this.addCssClassToCurrentSearchItem(this.currentSearchItemCounter);
                this.scrollInList(1);
            } else {
                this.ifShowAllOpen();
            }
        } else if (event.keyCode == 38) {
            if (this.isOpenAndHasSearchResults()) {
                if (this.currentSearchItemCounter != null) {
                    this.removeCssClassFromCurrentSearchItem(this.currentSearchItemCounter);
                    this.currentSearchItemCounter = (this.currentSearchItemCounter - 1 + this.searchResult.length) % this.searchResult.length;
                } else {
                    this.currentSearchItemCounter = 0;
                }
                this.addCssClassToCurrentSearchItem(this.currentSearchItemCounter);
                this.scrollInList(-1);
            }
        }
        return true;
    }

    private scrollInList(direction: number) {
        let currentItem = this.searchResult[this.currentSearchItemCounter];
        let ulElement: Element = document.getElementById('search-results-' + this.idClass);
        let liElement: Element = document.getElementById(this.idClass + '-' + currentItem.id);
        ulElement.scrollTop = (this.currentSearchItemCounter - direction) * liElement.scrollHeight;
        if (this.currentSearchItemCounter == 0) {
            ulElement.scrollTop = 0;
        } else if (this.currentSearchItemCounter == (this.searchResult.length - 1)) {
            ulElement.scrollTop = ulElement.scrollHeight;
        } else {
            ulElement.scrollTop = ulElement.scrollTop + direction * liElement.scrollHeight;
        }
    }

    private selectNull() {
        this.open = false;
        this.selectedItemId = null;
        this.searchTerm = '';
        this.publishAutoCompleteEvent();
    };

    searchablesChanged(newValue, oldValue) {
        this.updateSearchTerm();
    }

    selectedItemIdChanged(newValue, oldValue) {
        this.updateSearchTerm();
    }

    private isOpenAndHasSearchResults() {
        return this.open && this.searchResult.length > 0;
    };

    private removeCssClassFromCurrentSearchItem(currentSearchItemCounter: number) {
        let currentItem = this.searchResult[currentSearchItemCounter];
        if (!!currentItem) {
            let currentElement: Element = document.getElementById(this.idClass + '-' + currentItem.id);
            currentElement.classList.remove('search-item-current');
        }
    }

    private addCssClassToCurrentSearchItem(currentSearchItemCounter: number) {
        let currentItem: AutoCompleteItem = this.searchResult[currentSearchItemCounter];
        if (!!currentItem) {
            let currentElement: Element = document.getElementById(this.idClass + '-' + currentItem.id);
            currentElement.classList.add('search-item-current');
        }
    }

    selectSearchItem(item: AutoCompleteItem) {
        if (!!item) {
            this.selectedItemId = item.id;
            this.searchTerm = item.description;
            this.publishAutoCompleteEvent();
            this.open = false;
        }
    }

    private resetToSelected() {
        this.inputFieldChange();
        this.updateSearchTerm();
    }

    private publishAutoCompleteEvent() {
        let autoCompleteEvent: AutoCompleteEvent = new AutoCompleteEvent();
        autoCompleteEvent.id = this.selectedItemId;
        autoCompleteEvent.itemType = this.itemType;
        this.eventAggregator.publish(AutoCompleteEvent.AUTOCOMPLETE_EVENT, autoCompleteEvent);
    };

    filterItems(event: KeyboardEvent) {
        let searchTerm: string = this.searchTerm.trim();
        if (this.currentSearchItemCounter != null && this.open) {
            this.removeCssClassFromCurrentSearchItem(this.currentSearchItemCounter);
        }
        if (!!this.searches[searchTerm]) {
            this.searchResult = this.searches[searchTerm];
            this.open = !(this.searchResult.length == 0);
        } else if (searchTerm.length > 1) {
            this.searchResult = this.searchResult.filter(item => item.description.match(new RegExp('^' + searchTerm, 'i')) != null);
            this.searches[searchTerm] = this.searchResult;
            this.open = !(this.searchResult.length == 0);

        } else if (searchTerm.length < 2) {
            this.currentSearchItemCounter = null;
            this.open = this.showAll;
            this.searches = {};
            this.searchResult = this.searchables;
        }
    }

    ifShowAllOpen() {
        this.searchResult = this.searchables;
        this.open = this.showAll;
    }

    inputFieldChange() {
        this.clearSearch();
    }

    clearSearch() {
        this.searches = {};
        this.searchResult = this.searchables;
        this.currentSearchItemCounter = null;
    }

    clearSearchTerm() {
        this.searchTerm = '';
        this.open = false;
        this.selectedItemId = null;
        this.clearSearch();
        this.publishAutoCompleteEvent();
    }

    close() {
        if (this.selectedItemId) {
            this.updateSearchTerm();
        } else {
            this.selectNull();
        }
        this.open = false;
    }
}
