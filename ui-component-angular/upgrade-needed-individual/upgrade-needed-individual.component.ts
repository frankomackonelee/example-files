import { Component, OnInit, Input } from '@angular/core';
import { faqCode, FaqServiceService, help } from 'src/app/services/faq-service.service';
import { Observable } from 'rxjs';
import { LoginStateService } from 'src/app/states/login-state.service';
import { map, startWith, shareReplay } from 'rxjs/operators';
import { PremiumService } from 'src/app/services/buy-2020-premium.service';
import { GoogleanalyticsService, eventCategory, eventAction } from 'src/app/services/googleanalytics.service';
import { ABTestingService, ABTestCase } from 'src/app/services/a-b-testing.service';

@Component({
  selector: 'app-upgrade-needed-individual',
  templateUrl: './upgrade-needed-individual.component.html',
  styleUrls: ['./upgrade-needed-individual.component.scss']
})
export class UpgradeNeededIndividualComponent implements OnInit {
  faq: help
  @Input() set faqCode(value: faqCode){
    this.faq = this.faqService.getHelp(value)
  }

  @Input()
  public closeClickCallback: () => void;

  freeTrialJustStarted = false;

  public freeTrialOptionAvailable$: Observable<boolean>;

  public isATeacher$: Observable<boolean>;

  public readonly schoolHasSubscription$: Observable<boolean>;

  private abTestCase: ABTestCase;

  public abTestCase$: Observable<"A" | "B" | "None">

  constructor(private readonly faqService: FaqServiceService, 
    private loginStateService: LoginStateService,
    private premiuService: PremiumService,
    private googleanalyticsservice: GoogleanalyticsService,
    private abtestservice: ABTestingService) {
    
    this.abTestCase = abtestservice.getTest(eventCategory.ABTest15);

    this.freeTrialOptionAvailable$ = this.loginStateService.getUserLoginStatusWhenReady$().pipe(
      map(lg => lg.isEligibleForFreeTrial),
      startWith(false),
    )

    this.abTestCase$ = this.freeTrialOptionAvailable$.pipe(
      map((freeTrialAvailable) => {
        if(freeTrialAvailable){
          this.abTestCase.startTest();
          return this.abTestCase.case
        }else{
          return "None" as "A" | "B" | "None"
        }
      }),
      shareReplay()
    )

    this.isATeacher$ = this.loginStateService.getUserLoginStatusWhenReady$().pipe(
      map(lg => lg.isTeacher),
      startWith(false)
    )
  }

  ngOnInit() {}

  startAFreeTrial(buttonText: string){
    this.abTestCase.logVote();
    this.googleanalyticsservice.sendEvent(
      eventCategory.UpgradeIndividualOptionsModal,eventAction.StartFreeTrial, buttonText
    )
    this.premiuService.claimMyFreeTrialOfMembership().subscribe(
      (response) => {
        if(response.success){
          this.loginStateService.updateUserLoginStatus();
          this.freeTrialJustStarted = true;
        }
      })
    // this.closeClickCallback();
  }

  goToUpgrade(buttonText: string){
    this.googleanalyticsservice.sendEvent(
      eventCategory.UpgradeIndividualOptionsModal,eventAction.ClickForMembership, buttonText
    )
    this.closeClickCallback()
  }
}
